import { generateObject, embed } from "ai";
import { z } from "zod";
import { qwenFlash, qwenPlus, qwenMax, qwenEmbedding } from "@/lib/ai/qwen";
import { pool } from "@/lib/db";
import type {
  Email,
  ProcessedEmail,
  EmailCategory,
  RecommendedAction,
  ProcessedActionButton,
} from "@/types/email";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CategorySchema = z.enum([
  "newsletter",
  "alert",
  "personal",
  "promotion",
  "other",
]);

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

function normalizeActionButtons(rawButtons: RawActionButton[]): ProcessedActionButton[] {
  const buttons: ProcessedActionButton[] = [];

  for (const raw of rawButtons) {
    const actionLink = (raw.actionLink ?? raw.href ?? "").trim();
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
});

const RulesSchema = z.object({
  matchedRules: z
    .array(z.string())
    .describe("Exact text of each rule that applies to this email"),
});

// ─── Single email processing ──────────────────────────────────────────────────

async function processOneEmail(
  email: Email,
  userId: string,
  userRules: string[],
): Promise<ProcessedEmail> {
  const urlMatches = Array.from(
    new Set(email.body.match(/https?:\/\/[^\s)\]]+/g) ?? []),
  ).slice(0, 3);

  // Truncate body to avoid token limits — first 3 000 chars is plenty for classification
  const emailText = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Date: ${email.date}`,
    ``,
    email.body.slice(0, 3_000),
  ].join("\n");

  // ── Step 1 + 2 + 3 run concurrently ─────────────────────────────────────
  const [classifyResult, analysisResult, embedResult] = await Promise.all([
    // qwen3.6-flash — cheapest, fastest, good enough for a 5-way classification
    generateObject({
      model: qwenFlash,
      schema: z.object({ category: CategorySchema }),
      system:
        'Classify the email. Return JSON with exactly this shape: {"category": "<value>"}. ' +
        'The value must be one of: newsletter, alert, personal, promotion, other.',
      prompt: emailText,
    }),

    // qwen3.7-plus — balanced: summarise + todos + action
    generateObject({
      model: qwenPlus,
      schema: AnalysisSchema,
      system:
        'Analyse the email. Return JSON with exactly these fields:\n' +
        '- "summary": string — markdown allowed, max 2 sentences describing what the email is about\n' +
        '- "todos": string[] — markdown allowed action items, empty array if none\n' +
        '- "actionButtons": optional array. Each item should provide exactly:\n' +
        '  - "actionLabel": text label for button\n' +
        '  - "actionLink": URL or one of the exact action tokens: star, remove, reply\n' +
        '  - "actionColor": style hint like default, success, warning, danger, accent\n' +
        'If actionLink is star/remove/reply, do not invent URLs.\n' +
        '- "recommendedAction": must be exactly one of "archive", "keep", or "draft_reply"\n' +
        '  archive = no action needed | keep = important to retain | draft_reply = needs a response\n' +
        'Prefer URL buttons when clear CTA links exist in the email.',
      prompt: emailText,
    }),

    // text-embedding-v4 — 1024-dim embedding for pgvector semantic search
    embed({
      model: qwenEmbedding,
      value: `${email.subject}\n${email.body.slice(0, 500)}`,
    }),
  ]);

  // ── Step 4: rule evaluation — only if user has rules (qwen3.7-max) ────────
  let ruleMatches: string[] = [];
  if (userRules.length > 0) {
    try {
      const { object } = await generateObject({
        model: qwenMax,
        schema: RulesSchema,
        system:
          'Given a list of user-defined email rules, identify which rules apply to this email. ' +
          'Return JSON with exactly this shape: {"matchedRules": ["<exact rule text>", ...]}. ' +
          'Only include rules that clearly apply. Use empty array if none match.',
        prompt: `Rules:\n${userRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nEmail:\n${emailText}`,
      });
      ruleMatches = object.matchedRules;
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
    category: classifyResult.object.category as EmailCategory,
    summary: analysisResult.object.summary,
    todos: analysisResult.object.todos,
    actionButtons: [
      ...(analysisResult.object.actionButtons ?? []),
      ...urlMatches.map<ProcessedActionButton>((href, index) => ({
        label: index === 0 ? "Open Link" : `Open Link ${index + 1}`,
        kind: "url",
        href,
        tone: "accent",
      })),
    ],
    recommendedAction: analysisResult.object
      .recommendedAction as RecommendedAction,
    ruleMatches: ruleMatches.length > 0 ? ruleMatches : undefined,
  };

  // ── Persist to PostgreSQL ─────────────────────────────────────────────────
  const vectorLiteral = `[${embedResult.embedding.join(",")}]`;

  await pool.query(
    `INSERT INTO email_records (
       user_id, message_id, subject, sender, received_at,
       category, summary, todos, action_buttons, recommended_action,
       raw_body, embedding, attachment_urls
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, $13)
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
      processed.recommendedAction,
      email.body,
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
  const settled = await Promise.allSettled(
    emails.map((email) => processOneEmail(email, userId, userRules)),
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
