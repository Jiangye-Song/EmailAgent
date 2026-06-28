# Auto-Forwarding Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gmail OAuth polling pipeline with a Cloudflare Email Worker inbound pipeline and a three-panel inbox UI, supporting multi-user routing via per-user forwarding addresses.

**Architecture:** Each user gets a unique `{prefix}@{domain}` forwarding address stored in `users.forwarding_address`. Gmail auto-forward rules send mail there. A Cloudflare Email Worker receives MIME emails and POSTs them to `/api/inbound` with `X-Recipient` and `X-CF-Secret` headers. The route looks up the user by recipient address, parses the MIME, runs the existing Qwen pipeline, and persists results. The `/dashboard` route is replaced by a three-panel `/inbox`.

**Tech Stack:** Next.js 16 App Router, Cloudflare Email Workers, `mailparser` (MIME parsing), `web-push` (PWA notifications), PostgreSQL (PolarDB), Qwen AI SDK (`ai@7` + `@ai-sdk/openai-compatible`), TypeScript.

---

## File Map

**Create:**
- `cloudflare/email-worker.ts` — Cloudflare Email Worker (deployed separately, not part of Next.js build)
- `src/app/api/inbound/route.ts` — receives Cloudflare webhook, looks up user, runs pipeline
- `src/lib/email/parser.ts` — raw MIME buffer → `Email` object via `mailparser`
- `src/app/inbox/page.tsx` — server component, fetches records + category counts
- `src/components/inbox/InboxLayout.tsx` — `"use client"` wrapper, owns selection state
- `src/components/inbox/InboxSidebar.tsx` — category filter sidebar
- `src/components/inbox/EmailList.tsx` — scrollable email list panel
- `src/components/inbox/EmailDetail.tsx` — reading pane with actions
- `src/app/api/ics/[emailId]/route.ts` — streams `.ics` file download
- `src/lib/ics/generate.ts` — pure function: `CalendarEvent[]` → ICS string
- `src/app/api/notifications/subscribe/route.ts` — save Web Push subscription
- `src/lib/push/notify.ts` — `web-push` wrapper
- `public/manifest.json` — PWA manifest
- `public/sw.js` — service worker for push notifications

**Modify:**
- `scripts/db/schema.sql` — add migration block
- `src/types/db.ts` — add `calendar_events`, `draft_body`, `forwarding_address`
- `src/types/email.ts` — make Gmail-specific fields optional, add `CalendarEvent`
- `src/lib/ai/processor.ts` — add `draftReply` to analysis schema, add calendar extraction, update INSERT
- `src/auth.ts` — reduce scopes to `openid email profile` only
- `src/lib/actions/email-actions.ts` — remove Gmail deps, `approveAction` returns `mailto:` URL for `draft_reply`, `revalidatePath('/inbox')`
- `src/app/settings/page.tsx` — add forwarding address section, update "Back" link to `/inbox`
- `src/app/page.tsx` — redirect to `/inbox` instead of `/dashboard`

**Delete (after inbox is working):**
- `src/lib/mcp/gmail.ts`
- `src/lib/mcp/calendar.ts`
- `src/lib/tokens.ts`
- `src/app/api/process-emails/route.ts`
- `src/components/dashboard/TriggerButton.tsx`
- `src/components/digest/DigestSection.tsx`
- `src/components/digest/EmailCard.tsx`
- `src/components/hitl/ActionQueue.tsx`
- `src/components/hitl/ActionItem.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/loading.tsx`

---

## Task 1: DB Migration

**Files:**
- Modify: `scripts/db/schema.sql`
- Modify: `src/types/db.ts`

- [ ] **Step 1: Add migration SQL to schema.sql**

Append this block to the bottom of `scripts/db/schema.sql`:

```sql
-- ─── Phase 6 migration — auto-forwarding inbox ──────────────────────────────

-- Each user gets a unique forwarding address e.g. abc12345@yourdomain.com
alter table users
  add column if not exists forwarding_address text unique;

-- AI-extracted calendar events from email body
alter table email_records
  add column if not exists calendar_events jsonb default '[]';

-- AI-generated draft reply body (populated when recommended_action = 'draft_reply')
alter table email_records
  add column if not exists draft_body text;

-- Unique index so ON CONFLICT (gmail_id, user_id) works for deduplication
create unique index if not exists email_records_gmail_id_user_id_idx
  on email_records (gmail_id, user_id);

-- Web Push subscriptions for PWA notifications
create table if not exists push_subscriptions (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references users(id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now()
);
```

- [ ] **Step 2: Run migration against your local dev DB**

```bash
psql $DATABASE_URL -f scripts/db/schema.sql
```

Expected: no errors (all statements are idempotent with `IF NOT EXISTS` / `IF EXISTS`).

- [ ] **Step 3: Update `src/types/db.ts`**

Replace the entire file:

```ts
export type EmailRecord = {
  id: string;
  gmail_id: string;
  subject: string;
  sender: string;
  received_at: Date | null;
  category: "newsletter" | "alert" | "personal" | "promotion" | "other";
  summary: string;
  todos: string[];
  recommended_action: "archive" | "keep" | "draft_reply";
  action_status: "pending" | "approved" | "rejected" | "executed";
  raw_snippet: string;
  draft_body: string | null;
  calendar_events: CalendarEvent[];
  processed_at: Date;
};

export type CalendarEvent = {
  title: string;
  start: string;       // ISO 8601
  end?: string;        // ISO 8601
  description?: string;
  location?: string;
};

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};
```

- [ ] **Step 4: Verify TypeScript is happy**

```bash
npx tsc --noEmit
```

Expected: errors only in files that import the now-changed `EmailRecord` type (e.g. old dashboard components). Those will be fixed in later tasks — TypeScript errors here are acceptable and expected.

- [ ] **Step 5: Commit**

```bash
git add scripts/db/schema.sql src/types/db.ts
git commit -m "feat: db migration for forwarding_address, calendar_events, draft_body, push_subscriptions"
```

---

## Task 2: Install Dependencies

**Files:** `package.json`

- [ ] **Step 1: Install mailparser and web-push**

```bash
npm install mailparser web-push
npm install -D @types/mailparser @types/web-push
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('mailparser'); require('web-push'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add mailparser and web-push dependencies"
```

---

## Task 3: Update Email Types + MIME Parser

**Files:**
- Modify: `src/types/email.ts`
- Create: `src/lib/email/parser.ts`

- [ ] **Step 1: Update `src/types/email.ts`**

Replace the entire file. `threadId` and `labelIds` become optional (they don't exist in MIME-parsed mail):

```ts
export type EmailAttachment = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
};

export type Email = {
  /** Message-ID header (or UUID if absent) — used as deduplication key in gmail_id column */
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  /** First 200 chars of body — generated by parser when not provided by source */
  snippet: string;
  body: string;
  attachments: EmailAttachment[];
  labelIds?: string[];
};

export type EmailCategory =
  | "newsletter"
  | "alert"
  | "personal"
  | "promotion"
  | "other";

export type RecommendedAction = "archive" | "keep" | "draft_reply";

export type ProcessedEmail = {
  emailId: string;
  category: EmailCategory;
  summary: string;
  todos: string[];
  recommendedAction: RecommendedAction;
  draftBody?: string;
  calendarEvents?: import("@/types/db").CalendarEvent[];
  ruleMatches?: string[];
};
```

- [ ] **Step 2: Create `src/lib/email/parser.ts`**

```ts
import { simpleParser } from "mailparser";
import { randomUUID } from "crypto";
import type { Email } from "@/types/email";

export async function parseMimeEmail(raw: Buffer | string): Promise<Email> {
  const parsed = await simpleParser(raw);

  const body =
    parsed.text ??
    parsed.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ??
    "";

  return {
    id: parsed.messageId ?? randomUUID(),
    subject: parsed.subject ?? "(no subject)",
    from: parsed.from?.text ?? "",
    to: parsed.to
      ? Array.isArray(parsed.to)
        ? parsed.to.map((a) => a.text).join(", ")
        : parsed.to.text
      : "",
    date: parsed.date?.toISOString() ?? new Date().toISOString(),
    snippet: body.slice(0, 200),
    body,
    attachments: (parsed.attachments ?? []).map((a) => ({
      filename: a.filename ?? "attachment",
      mimeType: a.contentType,
      attachmentId: a.checksum ?? randomUUID(),
      size: a.size,
    })),
  };
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: fewer errors than Task 1 (Email type is now updated). Dashboard-related errors remain — will be fixed later.

- [ ] **Step 4: Commit**

```bash
git add src/types/email.ts src/lib/email/parser.ts
git commit -m "feat: update Email type for MIME source, add MIME parser"
```

---

## Task 4: Update AI Processor (Draft Body + Calendar Events)

**Files:**
- Modify: `src/lib/ai/processor.ts`

- [ ] **Step 1: Replace `src/lib/ai/processor.ts`**

The changes:
- `AnalysisSchema` gains optional `draftReply` field
- Add `CalendarSchema` and Step 5: calendar extraction
- `processOneEmail` stores `draft_body` and `calendar_events` in DB
- INSERT uses `ON CONFLICT (gmail_id, user_id) DO NOTHING`

```ts
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: `processor.ts` itself is clean. Dashboard component errors remain.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/processor.ts
git commit -m "feat: add draft reply and calendar event extraction to AI pipeline"
```

---

## Task 5: Inbound API Route

**Files:**
- Create: `src/app/api/inbound/route.ts`

- [ ] **Step 1: Create `src/app/api/inbound/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { pool } from "@/lib/db";
import { parseMimeEmail } from "@/lib/email/parser";
import { processEmailsBatched } from "@/lib/ai/processor";
import { sendPushNotification } from "@/lib/push/notify";

function validateSecret(incoming: string): boolean {
  const expected = process.env.CF_INBOUND_SECRET ?? "";
  if (!incoming || incoming.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cf-secret") ?? "";
  if (!validateSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Recipient lookup ──────────────────────────────────────────────────────
  const recipient = req.headers.get("x-recipient") ?? "";
  if (!recipient) {
    return NextResponse.json({ error: "Missing X-Recipient" }, { status: 400 });
  }

  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE forwarding_address = $1`,
    [recipient.toLowerCase()],
  );
  if (!userResult.rows.length) {
    return NextResponse.json({ error: "Unknown recipient" }, { status: 404 });
  }
  const userId = userResult.rows[0].id;

  // ── Parse MIME ────────────────────────────────────────────────────────────
  const rawBuffer = Buffer.from(await req.arrayBuffer());
  let email;
  try {
    email = await parseMimeEmail(rawBuffer);
  } catch (err) {
    console.error("[inbound] MIME parse error:", err);
    return NextResponse.json({ error: "Parse failed" }, { status: 422 });
  }

  // ── Load user rules ───────────────────────────────────────────────────────
  const rulesResult = await pool.query<{ rule_text: string }>(
    `SELECT rule_text FROM user_rules WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  const userRules = rulesResult.rows.map((r) => r.rule_text);

  // ── Run AI pipeline ───────────────────────────────────────────────────────
  const { results } = await processEmailsBatched([email], userId, userRules);

  // ── Push notification for calendar events ─────────────────────────────────
  const processed = results[0];
  if (processed?.calendarEvents?.length) {
    await sendPushNotification(userId, {
      title: "Calendar event detected",
      body: email.subject,
    }).catch((err) => console.warn("[inbound] Push failed:", err));
  }

  return NextResponse.json({ ok: true, processed: results.length });
}
```

- [ ] **Step 2: Note — `sendPushNotification` is defined in Task 12. For now, create a stub at `src/lib/push/notify.ts` so TypeScript resolves:**

```ts
// src/lib/push/notify.ts — stub, replaced in Task 12
export async function sendPushNotification(
  _userId: string,
  _payload: { title: string; body: string },
): Promise<void> {}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: `inbound/route.ts` resolves cleanly.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/inbound/route.ts src/lib/push/notify.ts
git commit -m "feat: add /api/inbound route for Cloudflare email webhook"
```

---

## Task 6: Cloudflare Email Worker

**Files:**
- Create: `cloudflare/email-worker.ts`

This file is **not** part of the Next.js build. It is deployed separately via `wrangler`.

- [ ] **Step 1: Create `cloudflare/email-worker.ts`**

```ts
export interface Env {
  CF_INBOUND_SECRET: string;
  INBOUND_URL: string; // e.g. https://your-fc-domain.com/api/inbound
}

export default {
  async email(
    message: {
      to: string;
      from: string;
      raw: ReadableStream<Uint8Array>;
    },
    env: Env,
  ): Promise<void> {
    const body = await new Response(message.raw).arrayBuffer();

    const res = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "message/rfc822",
        "X-CF-Secret": env.CF_INBOUND_SECRET,
        "X-Recipient": message.to,
      },
      body,
    });

    if (!res.ok) {
      throw new Error(`Inbound API returned ${res.status}`);
    }
  },
};
```

- [ ] **Step 2: Create `cloudflare/wrangler.toml`**

```toml
name = "email-agent-worker"
main = "email-worker.ts"
compatibility_date = "2024-09-23"

[vars]
INBOUND_URL = "https://YOUR_FUNCTION_COMPUTE_URL/api/inbound"

# Set via: wrangler secret put CF_INBOUND_SECRET
# Set via: wrangler secret put INBOUND_URL (if you prefer secrets over vars)
```

- [ ] **Step 3: Commit**

```bash
git add cloudflare/
git commit -m "feat: add Cloudflare Email Worker for inbound MIME forwarding"
```

---

## Task 7: Auth Scope Reduction

**Files:**
- Modify: `src/auth.ts`

- [ ] **Step 1: Replace scopes in `src/auth.ts`**

Change the `authorization.params.scope` from the Gmail+Calendar scope list to just `openid email profile`:

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { pool } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "online",
          response_type: "code",
          scope: "openid email profile",
        },
      },
    }),
  ],

  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
```

Note `access_type` changed to `"online"` — no refresh token needed since we no longer call Gmail API.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/auth.ts
git commit -m "feat: reduce Google OAuth scopes to profile/email only"
```

---

## Task 8: Forwarding Address Assignment

**Files:**
- Create: `src/lib/email/forwarding-address.ts`

- [ ] **Step 1: Create `src/lib/email/forwarding-address.ts`**

```ts
import { pool } from "@/lib/db";

/**
 * Ensures the user has a forwarding_address. Generates and persists one on
 * first call. Safe to call on every page render — idempotent.
 */
export async function ensureForwardingAddress(userId: string): Promise<string> {
  const existing = await pool.query<{ forwarding_address: string }>(
    `SELECT forwarding_address FROM users WHERE id = $1`,
    [userId],
  );

  if (existing.rows[0]?.forwarding_address) {
    return existing.rows[0].forwarding_address;
  }

  const domain = process.env.INBOUND_DOMAIN;
  if (!domain) throw new Error("INBOUND_DOMAIN env var is not set");

  // Use first 8 chars of userId (UUID without dashes) as the prefix
  const prefix = userId.replace(/-/g, "").slice(0, 8);
  const address = `${prefix}@${domain}`;

  await pool.query(
    `UPDATE users SET forwarding_address = $1 WHERE id = $2`,
    [address, userId],
  );

  return address;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email/forwarding-address.ts
git commit -m "feat: forwarding address generation and persistence"
```

---

## Task 9: Update Email Actions

**Files:**
- Modify: `src/lib/actions/email-actions.ts`

Remove Gmail API dependencies. `approveAction` now returns a `mailto:` URL for `draft_reply` actions.

- [ ] **Step 1: Replace `src/lib/actions/email-actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function approveAction(recordId: string): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { rows } = await pool.query<{
    sender: string;
    subject: string;
    recommended_action: string;
    draft_body: string | null;
  }>(
    `SELECT sender, subject, recommended_action, draft_body
     FROM email_records
     WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  if (!rows.length) throw new Error("Record not found");

  const { sender, subject, recommended_action, draft_body } = rows[0];

  await pool.query(
    `UPDATE email_records SET action_status = 'executed' WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");

  if (recommended_action === "draft_reply") {
    const url =
      `mailto:${encodeURIComponent(sender)}` +
      `?subject=${encodeURIComponent(`Re: ${subject}`)}` +
      `&body=${encodeURIComponent(draft_body ?? "")}`;
    return url;
  }

  return undefined;
}

export async function rejectAction(recordId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await pool.query(
    `UPDATE email_records SET action_status = 'rejected' WHERE id = $1 AND user_id = $2`,
    [recordId, session.user.id],
  );

  revalidatePath("/inbox");
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: errors in old dashboard components that import the old signature. Those will be deleted in Task 14.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/email-actions.ts
git commit -m "feat: update email actions — remove Gmail API, approveAction returns mailto URL"
```

---

## Task 10: Inbox Page (Server Component)

**Files:**
- Create: `src/app/inbox/page.tsx`
- Create: `src/components/inbox/InboxLayout.tsx` (shell — filled in Tasks 11-13)

- [ ] **Step 1: Create `src/components/inbox/InboxLayout.tsx` (shell)**

```tsx
"use client";

import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <div className="w-28 border-r shrink-0 p-2 text-xs text-muted-foreground">
        Sidebar placeholder
      </div>
      <div className="w-64 border-r shrink-0 overflow-y-auto p-2 text-xs text-muted-foreground">
        List placeholder ({records.length} emails)
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
        Detail placeholder · forwarding: {forwardingAddress}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/inbox/page.tsx`**

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { InboxLayout } from "@/components/inbox/InboxLayout";
import type { EmailRecord } from "@/types/db";

async function getEmailRecords(userId: string): Promise<EmailRecord[]> {
  const { rows } = await pool.query<EmailRecord>(
    `SELECT id, gmail_id, subject, sender, received_at, category, summary,
            todos, recommended_action, action_status, raw_snippet,
            draft_body, calendar_events, processed_at
     FROM email_records
     WHERE user_id = $1
     ORDER BY received_at DESC NULLS LAST
     LIMIT 200`,
    [userId],
  );
  return rows;
}

function buildCategoryCounts(records: EmailRecord[]): Record<string, number> {
  const counts: Record<string, number> = { all: records.length };
  for (const r of records) {
    counts[r.category] = (counts[r.category] ?? 0) + 1;
  }
  return counts;
}

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [records, forwardingAddress] = await Promise.all([
    getEmailRecords(session.user.id),
    ensureForwardingAddress(session.user.id),
  ]);

  const categoryCounts = buildCategoryCounts(records);

  return (
    <InboxLayout
      records={records}
      categoryCounts={categoryCounts}
      forwardingAddress={forwardingAddress}
    />
  );
}
```

- [ ] **Step 3: Update root page redirect**

Replace `src/app/page.tsx`:

```ts
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/inbox");
  redirect("/login");
}
```

- [ ] **Step 4: Start dev server and verify `/inbox` loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/inbox`. Expected: three placeholder columns render, no 500 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/inbox/page.tsx src/components/inbox/InboxLayout.tsx src/app/page.tsx
git commit -m "feat: scaffold inbox page with server data fetching"
```

---

## Task 11: InboxSidebar Component

**Files:**
- Create: `src/components/inbox/InboxSidebar.tsx`
- Modify: `src/components/inbox/InboxLayout.tsx`

- [ ] **Step 1: Create `src/components/inbox/InboxSidebar.tsx`**

```tsx
"use client";

import { Mail, Bell, User, Tag, Megaphone, Archive, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "All", icon: Mail },
  { key: "alert", label: "Alerts", icon: Bell },
  { key: "personal", label: "Personal", icon: User },
  { key: "newsletter", label: "Newsletter", icon: Tag },
  { key: "promotion", label: "Promotions", icon: Megaphone },
  { key: "other", label: "Other", icon: Archive },
] as const;

type Props = {
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
};

export function InboxSidebar({ categoryCounts, selectedCategory, onSelectCategory }: Props) {
  return (
    <div className="w-28 border-r shrink-0 flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      <div className="px-3 py-4 border-b">
        <div className="flex items-center gap-1.5">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold truncate">Inbox</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const count = categoryCounts[key] ?? 0;
          const isSelected = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => onSelectCategory(key)}
              className={cn(
                "w-full flex flex-col items-center gap-1 rounded-md py-2 px-1 text-center transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Link
          href="/settings"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Settings className="h-4 w-4" />
          <span className="text-[10px]">Settings</span>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire InboxSidebar into `InboxLayout.tsx`**

Replace the `InboxLayout.tsx` sidebar placeholder div with:

```tsx
"use client";

import { useState } from "react";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <InboxSidebar
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedId(null);
        }}
      />
      <div className="w-64 border-r shrink-0 overflow-y-auto p-2 text-xs text-muted-foreground">
        List placeholder ({filtered.length} emails)
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
        {selectedRecord
          ? `Selected: ${selectedRecord.subject}`
          : `No selection · forwarding: ${forwardingAddress}`}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Check dev server**

Click the sidebar categories. The list placeholder count should update. No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/inbox/InboxSidebar.tsx src/components/inbox/InboxLayout.tsx
git commit -m "feat: InboxSidebar with category filters and counts"
```

---

## Task 12: EmailList Component

**Files:**
- Create: `src/components/inbox/EmailList.tsx`
- Modify: `src/components/inbox/InboxLayout.tsx`

- [ ] **Step 1: Create `src/components/inbox/EmailList.tsx`**

```tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { EmailRecord } from "@/types/db";

const CATEGORY_COLORS: Record<string, string> = {
  alert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  personal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  newsletter: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  promotion: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

type Props = {
  records: EmailRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function EmailList({ records, selectedId, onSelect }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
        No emails in this category.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y overflow-y-auto">
      {records.map((record) => {
        const isSelected = record.id === selectedId;
        const relativeTime = record.received_at
          ? formatDistanceToNow(new Date(record.received_at), { addSuffix: true })
          : "";

        return (
          <button
            key={record.id}
            onClick={() => onSelect(record.id)}
            className={cn(
              "w-full text-left px-3 py-3 transition-colors border-l-2",
              isSelected
                ? "bg-primary/5 border-l-primary"
                : "border-l-transparent hover:bg-accent",
            )}
          >
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-semibold truncate">
                {record.sender.split("<")[0].trim() || record.sender}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {relativeTime}
              </span>
            </div>
            <p className="text-xs truncate text-foreground/80 mb-1">
              {record.subject}
            </p>
            <span
              className={cn(
                "text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                CATEGORY_COLORS[record.category],
              )}
            >
              {record.category}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Install `date-fns` if not already present**

```bash
npm install date-fns
```

- [ ] **Step 3: Wire EmailList into `InboxLayout.tsx`**

Replace the list placeholder div:

```tsx
"use client";

import { useState } from "react";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import { EmailList } from "@/components/inbox/EmailList";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <InboxSidebar
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedId(null);
        }}
      />
      <div className="w-64 border-r shrink-0 flex flex-col">
        <EmailList
          records={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4 text-xs text-muted-foreground">
        {selectedRecord
          ? `Selected: ${selectedRecord.subject}`
          : `Select an email · forwarding: ${forwardingAddress}`}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Check dev server**

Clicking an email row should highlight it (left border accent). No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/EmailList.tsx src/components/inbox/InboxLayout.tsx package.json package-lock.json
git commit -m "feat: EmailList panel with selection state"
```

---

## Task 13: EmailDetail Component

**Files:**
- Create: `src/components/inbox/EmailDetail.tsx`
- Modify: `src/components/inbox/InboxLayout.tsx`

- [ ] **Step 1: Create `src/components/inbox/EmailDetail.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Check, X, Reply, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approveAction, rejectAction } from "@/lib/actions/email-actions";
import type { EmailRecord } from "@/types/db";

type Props = {
  record: EmailRecord | null;
  forwardingAddress: string;
};

export function EmailDetail({ record, forwardingAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  if (!record) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
        <p className="text-sm">Select an email to read</p>
        <p className="text-xs">
          Forward your Gmail to{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
            {forwardingAddress}
          </code>
        </p>
      </div>
    );
  }

  const status = localStatus ?? record.action_status;

  const mailtoUrl =
    `mailto:${encodeURIComponent(record.sender)}` +
    `?subject=${encodeURIComponent(`Re: ${record.subject}`)}` +
    `&body=${encodeURIComponent(record.draft_body ?? "")}`;

  function handleApprove() {
    startTransition(async () => {
      const url = await approveAction(record.id);
      setLocalStatus("executed");
      if (url) window.open(url, "_blank");
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectAction(record.id);
      setLocalStatus("rejected");
    });
  }

  const hasCalendar =
    Array.isArray(record.calendar_events) && record.calendar_events.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <h2 className="text-base font-semibold leading-tight mb-1">
          {record.subject}
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>
            <span className="font-medium text-foreground">From:</span>{" "}
            {record.sender}
          </span>
          {record.received_at && (
            <span>
              {new Date(record.received_at).toLocaleString()}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] capitalize">
            {record.category}
          </Badge>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-b px-6 py-2 flex items-center gap-2 shrink-0 bg-zinc-50 dark:bg-zinc-900">
        {status === "pending" ? (
          <>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={handleApprove}
              disabled={isPending}
            >
              <Check className="h-3 w-3" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              onClick={handleReject}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
              Reject
            </Button>
          </>
        ) : (
          <Badge
            variant="secondary"
            className="text-[10px] capitalize"
          >
            {status}
          </Badge>
        )}

        <a href={mailtoUrl} className="inline-flex">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
            <Reply className="h-3 w-3" />
            Reply
          </Button>
        </a>

        {hasCalendar && (
          <a href={`/api/ics/${record.id}`} download>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
              <CalendarPlus className="h-3 w-3" />
              Add to Cal
            </Button>
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* AI Summary */}
        <div className="border-l-4 border-violet-400 pl-3 py-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-1">
            Summary
          </p>
          <p className="text-sm">{record.summary}</p>
        </div>

        {/* Action Items */}
        {record.todos?.length > 0 && (
          <div className="border-l-4 border-yellow-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-yellow-600 mb-1">
              Action Items
            </p>
            <ul className="space-y-1">
              {record.todos.map((todo, i) => (
                <li key={i} className="text-sm flex gap-2">
                  <span className="text-yellow-500 shrink-0">•</span>
                  {todo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Draft body preview (for draft_reply) */}
        {record.draft_body && (
          <div className="border-l-4 border-blue-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mb-1">
              Draft Reply
            </p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {record.draft_body}
            </p>
          </div>
        )}

        {/* Calendar events */}
        {hasCalendar && (
          <div className="border-l-4 border-green-400 pl-3 py-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-green-600 mb-1">
              Calendar Events
            </p>
            <ul className="space-y-1">
              {record.calendar_events.map((evt, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{evt.title}</span>
                  {" — "}
                  <span className="text-muted-foreground">
                    {new Date(evt.start).toLocaleString()}
                    {evt.end ? ` → ${new Date(evt.end).toLocaleString()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire EmailDetail into `InboxLayout.tsx`**

Final version of `src/components/inbox/InboxLayout.tsx`:

```tsx
"use client";

import { useState } from "react";
import { InboxSidebar } from "@/components/inbox/InboxSidebar";
import { EmailList } from "@/components/inbox/EmailList";
import { EmailDetail } from "@/components/inbox/EmailDetail";
import type { EmailRecord } from "@/types/db";

type Props = {
  records: EmailRecord[];
  categoryCounts: Record<string, number>;
  forwardingAddress: string;
};

export function InboxLayout({ records, categoryCounts, forwardingAddress }: Props) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered =
    selectedCategory === "all"
      ? records
      : records.filter((r) => r.category === selectedCategory);

  const selectedRecord = records.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <InboxSidebar
        categoryCounts={categoryCounts}
        selectedCategory={selectedCategory}
        onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedId(null);
        }}
      />
      <div className="w-64 border-r shrink-0 flex flex-col overflow-hidden">
        <EmailList
          records={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
      <EmailDetail record={selectedRecord} forwardingAddress={forwardingAddress} />
    </div>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors only in old dashboard/digest/hitl files not yet deleted.

- [ ] **Step 4: Test the full inbox UI in the browser**

```bash
npm run dev
```

- Navigate to `http://localhost:3000/inbox`
- Sidebar shows category filters
- Clicking a category filters the list
- Clicking an email row shows the detail pane
- Reply button generates a `mailto:` link
- Approve/Reject buttons update the status badge (optimistic)

- [ ] **Step 5: Commit**

```bash
git add src/components/inbox/EmailDetail.tsx src/components/inbox/InboxLayout.tsx
git commit -m "feat: EmailDetail reading pane with approve/reject/reply/calendar actions"
```

---

## Task 14: Update Settings Page + Delete Old Files

**Files:**
- Modify: `src/app/settings/page.tsx`
- Delete: 10 old files

- [ ] **Step 1: Update `src/app/settings/page.tsx`**

Add a forwarding address section at the top of `<main>` and update the "Back" link:

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { ensureForwardingAddress } from "@/lib/email/forwarding-address";
import { RulesEditor } from "@/components/settings/RulesEditor";
import { Separator } from "@/components/ui/separator";
import { Settings, ArrowLeft, Copy } from "lucide-react";
import Link from "next/link";

async function getUserRules(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ rule_text: string }>(
    `SELECT rule_text FROM user_rules WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return rows.map((r) => r.rule_text);
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [rules, forwardingAddress] = await Promise.all([
    getUserRules(session.user.id),
    ensureForwardingAddress(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Settings</span>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to inbox
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Forwarding address */}
        <section className="space-y-3">
          <div>
            <h1 className="text-xl font-bold">Gmail forwarding address</h1>
            <p className="text-sm text-muted-foreground mt-1">
              In Gmail → Settings → Forwarding, add this address and enable
              auto-forwarding.
            </p>
          </div>
          <Separator />
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
            <span className="flex-1 break-all">{forwardingAddress}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Gmail will send a verification email to this address — check your
            inbox after adding it.
          </p>
        </section>

        {/* Rules section */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">User-defined rules</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Write plain-language rules to guide how your emails are classified
              and acted on.
            </p>
          </div>
          <Separator />
          <RulesEditor initialRules={rules} />
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Delete old files**

```bash
git rm src/lib/mcp/gmail.ts src/lib/mcp/calendar.ts src/lib/tokens.ts
git rm src/app/api/process-emails/route.ts
git rm src/components/dashboard/TriggerButton.tsx
git rm src/components/digest/DigestSection.tsx src/components/digest/EmailCard.tsx
git rm src/components/hitl/ActionQueue.tsx src/components/hitl/ActionItem.tsx
git rm src/app/dashboard/page.tsx src/app/dashboard/loading.tsx
```

- [ ] **Step 3: Verify TypeScript is now clean**

```bash
npx tsc --noEmit
```

Expected: 0 errors. All the old imports are gone.

- [ ] **Step 4: Verify dev server still works**

```bash
npm run dev
```

Navigate `/inbox`, `/settings`. No broken imports.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: update settings page with forwarding address, delete old dashboard/Gmail files"
```

---

## Task 15: ICS Download (P1)

**Files:**
- Create: `src/lib/ics/generate.ts`
- Create: `src/app/api/ics/[emailId]/route.ts`

- [ ] **Step 1: Create `src/lib/ics/generate.ts`**

```ts
import type { CalendarEvent } from "@/types/db";

function fmtDt(iso: string): string {
  // Convert ISO 8601 to iCal DTSTART format: 20240101T120000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z");
}

export function generateIcs(events: CalendarEvent[], emailSubject: string): string {
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}@emailagent`;

  const vevents = events
    .map((e) => {
      const lines = [
        "BEGIN:VEVENT",
        `UID:${uid()}`,
        `DTSTAMP:${fmtDt(new Date().toISOString())}`,
        `DTSTART:${fmtDt(e.start)}`,
        e.end ? `DTEND:${fmtDt(e.end)}` : "",
        `SUMMARY:${e.title}`,
        e.description ? `DESCRIPTION:${e.description.replace(/\n/g, "\\n")}` : "",
        e.location ? `LOCATION:${e.location}` : "",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .join("\r\n");
      return lines;
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EmailAgent//EN",
    `X-WR-CALNAME:${emailSubject}`,
    vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}
```

- [ ] **Step 2: Create `src/app/api/ics/[emailId]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { generateIcs } from "@/lib/ics/generate";
import type { CalendarEvent } from "@/types/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

  const { emailId } = await params;

  const { rows } = await pool.query<{
    subject: string;
    calendar_events: CalendarEvent[];
  }>(
    `SELECT subject, calendar_events FROM email_records WHERE id = $1 AND user_id = $2`,
    [emailId, session.user.id],
  );

  if (!rows.length) return new NextResponse("Not found", { status: 404 });

  const { subject, calendar_events } = rows[0];
  if (!calendar_events?.length) {
    return new NextResponse("No calendar events", { status: 404 });
  }

  const ics = generateIcs(calendar_events, subject);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"`,
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ics/generate.ts src/app/api/ics/
git commit -m "feat: ICS calendar file download from calendar_events"
```

---

## Task 16: PWA Manifest + Service Worker (P1)

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "Email Agent",
  "short_name": "EmailAgent",
  "description": "AI-powered email inbox",
  "start_url": "/inbox",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#7c3aed",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Note: add placeholder icon files or real icons to `public/`. For hackathon, a placeholder is fine.

- [ ] **Step 2: Create `public/sw.js`**

```js
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Email Agent", {
      body: data.body ?? "",
      icon: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/inbox"));
});
```

- [ ] **Step 3: Add manifest link and SW registration to `src/app/layout.tsx`**

In the `<head>` section of layout.tsx, add:
```tsx
<link rel="manifest" href="/manifest.json" />
```

Add a `<Script>` tag (or inline script in a client component) to register the service worker. Since `layout.tsx` is a server component, add a tiny client component `src/components/SwRegistration.tsx`:

```tsx
"use client";
import { useEffect } from "react";

export function SwRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.warn);
    }
  }, []);
  return null;
}
```

Then import and render `<SwRegistration />` inside `layout.tsx`'s `<body>`.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json public/sw.js src/components/SwRegistration.tsx src/app/layout.tsx
git commit -m "feat: PWA manifest and service worker for push notifications"
```

---

## Task 17: Push Notification Subscribe Endpoint (P1)

**Files:**
- Modify: `src/lib/push/notify.ts` (replace stub with real implementation)
- Create: `src/app/api/notifications/subscribe/route.ts`

- [ ] **Step 1: Replace `src/lib/push/notify.ts`**

```ts
import webpush from "web-push";
import { pool } from "@/lib/db";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string },
): Promise<void> {
  const { rows } = await pool.query<{
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId],
  );

  await Promise.allSettled(
    rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ),
    ),
  );
}
```

- [ ] **Step 2: Create `src/app/api/notifications/subscribe/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [session.user.id, endpoint, keys.p256dh, keys.auth],
  );

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Generate VAPID keys and add to .env.local**

```bash
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(JSON.stringify(keys, null, 2))"
```

Copy the output and add to `.env.local`:
```
VAPID_PUBLIC_KEY=<publicKey from output>
VAPID_PRIVATE_KEY=<privateKey from output>
VAPID_SUBJECT=mailto:huckzishere@gmail.com
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/notify.ts src/app/api/notifications/subscribe/route.ts
git commit -m "feat: web push notification subscribe endpoint and send utility"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Cloudflare Email Worker | Task 6 |
| `/api/inbound` with secret + recipient lookup | Task 5 |
| MIME parsing | Task 3 |
| Multi-user forwarding address | Task 8 |
| Auth scope reduction | Task 7 |
| AI pipeline: draft reply generation | Task 4 |
| AI pipeline: calendar event extraction | Task 4 |
| DB: `forwarding_address`, `calendar_events`, `draft_body`, `push_subscriptions` | Task 1 |
| Three-panel inbox (sidebar / list / detail) | Tasks 10–13 |
| Approve → `mailto:` URL | Tasks 9 + 13 |
| Reply button (always available) | Task 13 |
| Add to Cal button (conditional) | Task 13 |
| ICS download | Task 15 |
| PWA manifest + service worker | Task 16 |
| Push subscription endpoint | Task 17 |
| Settings page: forwarding address display | Task 14 |
| Delete old dashboard/Gmail files | Task 14 |

All spec requirements are covered.

### Env Vars Summary

Add these to `.env.local` and to Alibaba Cloud Function Compute env config:

```env
# Existing
DATABASE_URL=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
NEXTAUTH_SECRET=
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# New
CF_INBOUND_SECRET=          # any random string, shared with Cloudflare Worker
INBOUND_DOMAIN=             # domain bought on Cloudflare, e.g. emailagent.xyz
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:huckzishere@gmail.com
```

Cloudflare Worker env vars (set via `wrangler secret put`):
```
CF_INBOUND_SECRET=          # same value as above
INBOUND_URL=                # e.g. https://your-fc-domain.com/api/inbound
```
