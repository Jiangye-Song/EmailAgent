import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import { qwenClient, QWEN_FLASH, QWEN_PLUS, QWEN_MAX, QWEN_EMBEDDING } from "@/lib/ai/qwen";
import { pool } from "@/lib/db";
import { DEFAULT_CATEGORY_PROMPTS } from "@/lib/ai/category-prompts";
import type {
  Email,
  ProcessedEmail,
  EmailCategory,
  RecommendedAction,
  ProcessedActionButton,
} from "@/types/email";
import type { CalendarEvent, UserCategory } from "@/types/db";

// ─── LLM helper ──────────────────────────────────────────────────────────────

async function generateParsed<T>(
  model: string,
  messages: ChatCompletionMessageParam[],
  schema: z.ZodType<T>,
): Promise<T> {
  // Qwen requires the word "json" in the messages when response_format is json_object.
  const messagesWithJson = injectJsonKeyword(messages);

  const completion = await qwenClient.chat.completions.create({
    model,
    messages: messagesWithJson,
    response_format: { type: "json_object" },
  });
  const content = completion.choices[0].message.content;
  console.log(`[generateParsed:${model}] raw response:`, content);
  if (!content) throw new Error("[generateParsed] Empty response from model");
  const parsed = JSON.parse(content);
  // Some models wrap the object in an array — unwrap it
  const data = Array.isArray(parsed) ? parsed[0] : parsed;
  return schema.parse(data);
}

function injectJsonKeyword(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const hasJson = messages.some((m) => {
    const text = typeof m.content === "string" ? m.content : "";
    return /json/i.test(text);
  });
  if (hasJson) return messages;

  const systemIdx = messages.findIndex((m) => m.role === "system");
  if (systemIdx >= 0 && typeof messages[systemIdx].content === "string") {
    const updated = [...messages];
    updated[systemIdx] = {
      ...messages[systemIdx],
      content: `${messages[systemIdx].content as string}\n\nRespond with valid JSON.`,
    };
    return updated;
  }

  return [{ role: "system", content: "Respond with valid JSON." }, ...messages];
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

type CategoryPromptMap = Record<UserCategory, string>;

type UserCategoryConfig = {
  key: string;
  label: string;
};

function normalizeButtonTone(
  tone: string | undefined,
): ProcessedActionButton["tone"] | undefined {
  if (!tone) return undefined;

  const value = tone.toLowerCase();
  if (value === "default") return "default";
  if (value === "success") return "success";
  if (value === "warning") return "warning";
  if (value === "danger") return "danger";
  if (value === "accent") return "accent";

  // Common model aliases to keep schema validation permissive.
  if (value === "primary") return "accent";
  if (value === "secondary") return "accent";
  if (value === "error") return "danger";

  return "default";
}

type RawActionButton = {
  actionLabel?: string;
  actionLink?: string;
  actionColor?: string;
  label?: string;
  href?: string;
  tone?: string;
  kind?: string;
};

function normalizeActionLinkToKind(
  actionLink: string,
): ProcessedActionButton["kind"] {
  const value = actionLink.trim().toLowerCase();
  if (value === "star") return "star";
  if (value === "remove") return "remove";
  if (value === "reply") return "reply";
  return "url";
}

function normalizeActionLink(actionLink: string): string {
  return actionLink.trim().replace(/^<(.+)>$/, "$1");
}

function normalizeActionButtons(rawButtons: RawActionButton[]): ProcessedActionButton[] {
  const buttons: ProcessedActionButton[] = [];

  for (const raw of rawButtons) {
    const actionLink = normalizeActionLink(raw.actionLink ?? raw.href ?? "");
    if (!actionLink) continue;

    const kind = normalizeActionLinkToKind(actionLink);

    if (kind === "star") {
      buttons.push({ label: "Star", kind: "star", tone: "warning" });
      continue;
    }

    if (kind === "remove") {
      buttons.push({ label: "Remove", kind: "remove", tone: "danger" });
      continue;
    }

    if (kind === "reply") {
      buttons.push({ label: "Reply", kind: "reply", tone: "accent" });
      continue;
    }

    buttons.push({
      label: (raw.actionLabel ?? raw.label ?? "Open Link").trim() || "Open Link",
      kind: "url",
      href: actionLink,
      tone: normalizeButtonTone(raw.actionColor ?? raw.tone),
    });
  }

  return buttons;
}

const AnalysisSchema = z.object({
  summary: z
    .string()
    .describe("Max 2 sentences summarising what the email is about"),
  todos: z
    .array(z.string())
    .describe("Concrete action items the recipient needs to do"),
  actionButtons: z
    .array(
      z.object({
        actionLabel: z.string().optional(),
        actionLink: z.string().optional(),
        actionColor: z.string().optional(),
        // Backward-compatible keys from previous prompt versions.
        label: z.string().optional(),
        href: z.string().optional(),
        tone: z.string().optional(),
        kind: z.string().optional(),
      }).transform((button) => ({
        ...button,
        actionLink: button.actionLink ?? button.href ?? button.kind,
      })),
    )
    .optional()
    .transform((buttons) => normalizeActionButtons((buttons ?? []) as RawActionButton[]))
    .describe(
      "Optional structured actions. Each item should include actionLabel, actionLink, actionColor.",
    ),
  recommendedAction: z
    .enum(["archive", "keep", "draft_reply"])
    .describe(
      "archive = no action needed, keep = important to retain, draft_reply = needs a response",
    ),
  draftReply: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined)
    .describe("Optional draft response body if replying is helpful"),
  calendarEvents: z
    .array(
      z.object({
        title: z.string(),
        start: z.string(),
        end: z.string().optional(),
        description: z.string().optional(),
        location: z.string().optional(),
      }),
    )
    .optional()
    .describe("Calendar-like events inferred from the email content"),
  isPriority: z
    .boolean()
    .describe("True if this email deserves high-priority visual emphasis in the inbox"),
});

const RulesSchema = z.object({
  matchedRules: z
    .array(z.string())
    .describe("Exact text of each rule that applies to this email"),
});

function buildRulesContext(userRules: string[]): string {
  if (userRules.length === 0) {
    return "No user rules were provided.";
  }

  return `User rules:\n${userRules.map((rule, index) => `${index + 1}. ${rule}`).join("\n")}`;
}

async function loadUserCategoryPrompts(userId: string): Promise<CategoryPromptMap> {
  const prompts: CategoryPromptMap = { ...DEFAULT_CATEGORY_PROMPTS };

  try {
    const { rows } = await pool.query<{ category: UserCategory; prompt: string }>(
      `SELECT category, prompt
       FROM user_category_prompts
       WHERE user_id = $1`,
      [userId],
    );

    for (const row of rows) {
      if (!row.prompt?.trim()) continue;
      prompts[row.category] = row.prompt;
    }
  } catch (error) {
    console.warn("[processor] Could not load category prompts, using defaults:", error);
  }

  return prompts;
}

async function loadUserCategories(userId: string): Promise<UserCategoryConfig[]> {
  const { rows } = await pool.query<{ category_key: string; display_name: string }>(
    `SELECT category_key, display_name
     FROM user_categories
     WHERE user_id = $1 AND is_active = true
     ORDER BY created_at ASC`,
    [userId],
  );

  if (rows.length === 0) {
    return [
      { key: "newsletter", label: "Newsletter" },
      { key: "alert", label: "Alerts" },
      { key: "personal", label: "Personal" },
      { key: "promotion", label: "Promotions" },
      { key: "other", label: "Other" },
    ];
  }

  return rows.map((row) => ({ key: row.category_key, label: row.display_name }));
}

// ─── Single email processing ──────────────────────────────────────────────────

async function processOneEmail(
  email: Email,
  userId: string,
  userRules: string[],
  categoryPrompts: CategoryPromptMap,
  categories: UserCategoryConfig[],
): Promise<ProcessedEmail> {

  // Truncate body to avoid token limits — first 3 000 chars is plenty for classification
  const emailText = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Date: ${email.date}`,
    ``,
    email.body.slice(0, 3_000),
  ].join("\n");

  const rulesContext = buildRulesContext(userRules);

  // ── Stage 1 agent: category classification ───────────────────────────────
  const allowedCategoryKeys = categories.map((category) => category.key);

  const classifyResult = await generateParsed(
    QWEN_FLASH,
    [
      {
        role: "system",
        content:
          "You are stage 1 classification agent. Classify the email into exactly one of the allowed category keys. " +
          "Use user rules as additional context.",
      },
      {
        role: "user",
        content:
          `${rulesContext}\n\nAllowed categories:\n` +
          categories.map((category) => `- ${category.key}: ${category.label}`).join("\n") +
          `\n\nEmail:\n${emailText}`,
      },
    ],
    z.object({ category: z.string() }),
  );

  const rawCategory = classifyResult.category.trim().toLowerCase();
  const category = (
    allowedCategoryKeys.includes(rawCategory)
      ? rawCategory
      : allowedCategoryKeys.includes("other")
        ? "other"
        : allowedCategoryKeys[0]
  ) as EmailCategory;
  const categoryPrompt = categoryPrompts[category as UserCategory] ?? DEFAULT_CATEGORY_PROMPTS.other;

  // ── Stage 2 agent + embedding in parallel ────────────────────────────────
  const [analysisResult, embedResult] = await Promise.all([
    generateParsed(
      QWEN_PLUS,
      [
        {
          role: "system",
          content:
            "You are stage 2 category-specialist analysis agent.\n\n" +
            `Selected category: ${category}.\n` +
            `Category-specific prompt:\n${categoryPrompt}\n\n` +
            `${rulesContext}\n\n` +
            'Required fields:\n' +
            '- summary: max 2 sentences\n' +
            '- todos: concrete action items array\n' +
            '- actionButtons: optional array with actionLabel/actionLink/actionColor. ' +
            '  actionLabel must be a short verb phrase describing the action, e.g. "View Invoice", "Track Shipment", "Reset Password", "Join Meeting". ' +
            '  Never use generic labels like "Open Link" or "Click Here".\n' +
            '- URLs in todos or actionButtons: copy the complete original URL, including protocol, path, query string, and fragment. ' +
            '  If the email wraps a URL in angle brackets like <https://example.com/path?x=1>, output https://example.com/path?x=1 without the surrounding < or >. ' +
            '  Never truncate a URL to only its first part and never include a trailing >.\n' +
            '- recommendedAction: archive|keep|draft_reply\n' +
            '- draftReply: optional string\n' +
            '- calendarEvents: array of inferred events (title, start, optional end/description/location)\n' +
            '- isPriority: boolean; true when this email should visually stand out as priority',
        },
        { role: "user", content: `Email:\n${emailText}` },
      ],
      AnalysisSchema,
    ),

    // text-embedding-v4 — 1024-dim embedding for pgvector semantic search
    qwenClient.embeddings.create({
      model: QWEN_EMBEDDING,
      input: `${email.subject}\n${email.body.slice(0, 500)}`,
    }),
  ]);

  // ── Optional explicit matched-rules pass for transparency ─────────────────
  let ruleMatches: string[] = [];
  if (userRules.length > 0) {
    try {
      const rulesResult = await generateParsed(
        QWEN_MAX,
        [
          {
            role: "system",
            content:
              'Given a list of user-defined email rules, identify which rules apply to this email. ' +
              'Only include rules that clearly apply. Use empty array if none match.',
          },
          {
            role: "user",
            content: `${rulesContext}\n\nCategory: ${category}\n\nEmail:\n${emailText}`,
          },
        ],
        RulesSchema,
      );
      ruleMatches = rulesResult.matchedRules;
    } catch (err) {
      // Non-critical — rule evaluation failure must not block the pipeline
      console.warn(
        `[processor] Rule evaluation failed for email ${email.id}:`,
        err,
      );
    }
  }

  const processed: ProcessedEmail = {
    emailId: email.id,
    category,
    isPriority: analysisResult.isPriority,
    summary: analysisResult.summary,
    todos: analysisResult.todos,
    actionButtons: analysisResult.actionButtons ?? [],
    recommendedAction: analysisResult.recommendedAction as RecommendedAction,
    draftBody: analysisResult.draftReply,
    calendarEvents: (analysisResult.calendarEvents ?? []) as CalendarEvent[],
    ruleMatches: ruleMatches.length > 0 ? ruleMatches : undefined,
  };

  // ── Persist to PostgreSQL ─────────────────────────────────────────────────
  const vectorLiteral = `[${embedResult.data[0].embedding.join(",")}]`;

  await pool.query(
    `INSERT INTO email_records (
       user_id, message_id, subject, sender, received_at,
       category, summary, todos, action_buttons, is_priority, recommended_action,
       raw_body, draft_body, calendar_events, embedding, attachment_urls
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15::vector, $16
     )
     ON CONFLICT DO NOTHING`,
    [
      userId,
      email.id,
      email.subject,
      email.from,
      email.date ? new Date(email.date) : new Date(),
      processed.category,
      processed.summary,
      JSON.stringify(processed.todos),
      JSON.stringify(processed.actionButtons ?? []),
      processed.isPriority,
      processed.recommendedAction,
      email.body,
      processed.draftBody ?? null,
      JSON.stringify(processed.calendarEvents ?? []),
      vectorLiteral,
      JSON.stringify(
        email.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
        })),
      ),
    ],
  );

  return processed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type BatchResult = {
  results: ProcessedEmail[];
  errors: { emailId: string; error: string }[];
};

/**
 * Process a batch of emails concurrently.
 * Each email runs through: classify → analyse → embed → (optional) rules → DB persist.
 * Uses Promise.allSettled so one failure does not abort the entire batch.
 */
export async function processEmailsBatched(
  emails: Email[],
  userId: string,
  userRules: string[] = [],
): Promise<BatchResult> {
  const [categoryPrompts, userCategories] = await Promise.all([
    loadUserCategoryPrompts(userId),
    loadUserCategories(userId),
  ]);

  const settled = await Promise.allSettled(
    emails.map((email) => processOneEmail(email, userId, userRules, categoryPrompts, userCategories)),
  );

  const results: ProcessedEmail[] = [];
  const errors: { emailId: string; error: string }[] = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      errors.push({
        emailId: emails[i].id,
        error:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      });
      console.error(
        `[processor] Failed to process email ${emails[i].id}:`,
        outcome.reason,
      );
    }
  }

  return { results, errors };
}

// ─── Daily digest builder ─────────────────────────────────────────────────────

/**
 * Persist the day's processed results as a JSONB digest export.
 * Creates or replaces the row for today's date.
 */
export async function saveDailyDigest(
  userId: string,
  results: ProcessedEmail[],
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const payload = {
    date: today,
    totalProcessed: results.length,
    byCategory: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    pendingActions: results.filter((r) => r.recommendedAction !== "keep")
      .length,
    emails: results,
  };

  await pool.query(
    `INSERT INTO digest_exports (user_id, date, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET payload = EXCLUDED.payload`,
    [userId, today, JSON.stringify(payload)],
  );
}
