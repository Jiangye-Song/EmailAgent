import { generateObject, embed } from "ai";
import { z } from "zod";
import { qwenFlash, qwenPlus, qwenMax, qwenEmbedding } from "@/lib/ai/qwen";
import { pool } from "@/lib/db";
import type { Email, ProcessedEmail, EmailCategory, RecommendedAction } from "@/types/email";
import type { CalendarEvent } from "@/types/db";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const CategorySchema = z.enum([
  "newsletter",
  "alert",
  "personal",
  "promotion",
  "other",
]);

const AnalysisSchema = z.object({
  summary: z
    .string()
    .describe("Max 2 sentences summarising what the email is about"),
  todos: z
    .array(z.string())
    .describe("Concrete action items the recipient needs to do"),
  recommendedAction: z
    .enum(["archive", "keep", "draft_reply"])
    .describe(
      "archive = no action needed, keep = important to retain, draft_reply = needs a response",
    ),
  draftReply: z
    .string()
    .optional()
    .describe(
      "A short, professional draft reply — include ONLY when recommendedAction is draft_reply",
    ),
});

const RulesSchema = z.object({
  matchedRules: z
    .array(z.string())
    .describe("Exact text of each rule that applies to this email"),
});

const CalendarSchema = z.object({
  events: z.array(
    z.object({
      title: z.string().describe("Event title"),
      start: z.string().describe("ISO 8601 date-time string"),
      end: z.string().optional().describe("ISO 8601 date-time string"),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
  ),
});

// ─── Single email processing ──────────────────────────────────────────────────

async function processOneEmail(
  email: Email,
  userId: string,
  userRules: string[],
): Promise<ProcessedEmail> {
  const emailText = [
    `Subject: ${email.subject}`,
    `From: ${email.from}`,
    `Date: ${email.date}`,
    ``,
    email.body.slice(0, 3_000),
  ].join("\n");

  // ── Steps 1 + 2 + 3 concurrently ────────────────────────────────────────
  const [classifyResult, analysisResult, embedResult] = await Promise.all([
    generateObject({
      model: qwenFlash,
      schema: z.object({ category: CategorySchema }),
      system:
        'Classify the email. Return JSON with exactly this shape: {"category": "<value>"}. ' +
        "The value must be one of: newsletter, alert, personal, promotion, other.",
      prompt: emailText,
    }),

    generateObject({
      model: qwenPlus,
      schema: AnalysisSchema,
      system:
        "Analyse the email. Return JSON with exactly these fields:\n" +
        '- "summary": string — max 2 sentences\n' +
        '- "todos": string[] — action items, empty array if none\n' +
        '- "recommendedAction": one of "archive", "keep", "draft_reply"\n' +
        '- "draftReply": string — include ONLY when recommendedAction is "draft_reply"',
      prompt: emailText,
    }),

    embed({
      model: qwenEmbedding,
      value: `${email.subject}\n${email.body.slice(0, 500)}`,
    }),
  ]);

  // ── Step 4: rule evaluation ──────────────────────────────────────────────
  let ruleMatches: string[] = [];
  if (userRules.length > 0) {
    try {
      const { object } = await generateObject({
        model: qwenMax,
        schema: RulesSchema,
        system:
          "Given a list of user-defined email rules, identify which rules apply to this email. " +
          'Return JSON: {"matchedRules": ["<exact rule text>", ...]}. Empty array if none match.',
        prompt: `Rules:\n${userRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\nEmail:\n${emailText}`,
      });
      ruleMatches = object.matchedRules;
    } catch (err) {
      console.warn(`[processor] Rule evaluation failed for ${email.id}:`, err);
    }
  }

  // ── Step 5: calendar extraction ──────────────────────────────────────────
  let calendarEvents: CalendarEvent[] = [];
  const hasDateHint =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/\-]\d{1,2}|deadline|schedule|meeting|event|appointment)\b/i.test(
      email.body,
    );
  if (hasDateHint) {
    try {
      const { object } = await generateObject({
        model: qwenMax,
        schema: CalendarSchema,
        system:
          "Extract calendar events from this email. Return ISO 8601 date-times. " +
          'Return {"events": []} if no real events are present.',
        prompt: emailText,
      });
      calendarEvents = object.events;
    } catch (err) {
      console.warn(`[processor] Calendar extraction failed for ${email.id}:`, err);
    }
  }

  const processed: ProcessedEmail = {
    emailId: email.id,
    category: classifyResult.object.category as EmailCategory,
    summary: analysisResult.object.summary,
    todos: analysisResult.object.todos,
    recommendedAction: analysisResult.object.recommendedAction as RecommendedAction,
    draftBody: analysisResult.object.draftReply,
    calendarEvents: calendarEvents.length > 0 ? calendarEvents : undefined,
    ruleMatches: ruleMatches.length > 0 ? ruleMatches : undefined,
  };

  // ── Persist ──────────────────────────────────────────────────────────────
  const vectorLiteral = `[${embedResult.embedding.join(",")}]`;

  await pool.query(
    `INSERT INTO email_records (
       user_id, gmail_id, subject, sender, received_at,
       category, summary, todos, recommended_action,
       raw_snippet, embedding, attachment_urls,
       draft_body, calendar_events
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, $12, $13, $14)
     ON CONFLICT (gmail_id, user_id) DO NOTHING`,
    [
      userId,
      email.id,
      email.subject,
      email.from,
      email.date ? new Date(email.date) : new Date(),
      processed.category,
      processed.summary,
      JSON.stringify(processed.todos),
      processed.recommendedAction,
      email.snippet,
      vectorLiteral,
      JSON.stringify(
        email.attachments.map((a) => ({
          filename: a.filename,
          mimeType: a.mimeType,
          size: a.size,
          attachmentId: a.attachmentId,
        })),
      ),
      processed.draftBody ?? null,
      JSON.stringify(processed.calendarEvents ?? []),
    ],
  );

  return processed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type BatchResult = {
  results: ProcessedEmail[];
  errors: { emailId: string; error: string }[];
};

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
      console.error(`[processor] Failed ${emails[i].id}:`, outcome.reason);
    }
  }

  return { results, errors };
}

export async function saveDailyDigest(
  userId: string,
  results: ProcessedEmail[],
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    date: today,
    totalProcessed: results.length,
    byCategory: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    pendingActions: results.filter((r) => r.recommendedAction !== "keep").length,
    emails: results,
  };
  await pool.query(
    `INSERT INTO digest_exports (user_id, date, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, date) DO UPDATE SET payload = EXCLUDED.payload`,
    [userId, today, JSON.stringify(payload)],
  );
}
