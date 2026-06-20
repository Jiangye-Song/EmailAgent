# Email Digest Agent — Project Plan

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router), React, TypeScript |
| Styling & UI | Tailwind CSS, shadcn/ui, Lucide Icons |
| Database & Auth | Supabase (PostgreSQL) + Google OAuth (Gmail + Calendar scopes) |
| AI & Orchestration | Vercel AI SDK, Qwen Cloud API (`qwen-turbo` / `qwen-max`) |
| Tooling Protocol | `@modelcontextprotocol/sdk` (Gmail / Calendar tools) |

**Architecture Constraint:** Core logic must be decoupled from API Route handlers so the pipeline can be migrated to Upstash Workflow if Vercel's 60 s execution limit is hit. Use `Promise.all` for concurrent email processing.

---

## Feature Priorities

### P0 — Must Have

- [ ] Gmail Email Reading (OAuth + fetch unread emails)
- [ ] Email Classification (Newsletter / Alert / Personal / Promotion / …)
- [ ] Email Summarization (concise per-email summary)
- [ ] Todo Extraction (actionable tasks from email bodies)
- [ ] Daily Digest Page (`/dashboard`)
- [ ] HITL Confirmation Queue (Approve / Reject actions before execution)

### P1 — Bonus

- [ ] Auto-generate Reply Drafts
- [ ] Auto Label / Archive via Gmail API
- [ ] Google Calendar Integration (parse dates → suggest events)
- [ ] User-Defined Rules Engine (natural-language rules injected into system prompt)
  - "Always keep emails from school"
  - "Archive promotions unless discount > 40 %"
  - "Never send emails without my approval"
  - "Flag emails related to jobs, invoices, and interviews"

### P2 — Advanced / Backlog

- [ ] Auto-unsubscribe suggestions
- [ ] Multi-user / team inbox support
- [ ] CRM integration / Slack digest / Quote generation

---

## Execution Phases

### Phase 1 — Infrastructure & Auth (Day 1)

**Goal:** Authenticated user can log in and their tokens are persisted.

- [x] Initialize Next.js project (TypeScript, Tailwind, App Router, `src/` dir)
- [x] Initialize git repository
- [ ] Install and configure shadcn/ui
- [ ] Create Supabase project
- [ ] Enable Google OAuth provider in Supabase with scopes:
  - `https://mail.google.com/`
  - `https://www.googleapis.com/auth/calendar`
- [ ] Implement login / logout flow (`src/app/(auth)/login/page.tsx`)
- [ ] Store `access_token` + `refresh_token` in Supabase (`user_tokens` table)

**Supabase Schema (Phase 1):**

```sql
-- User OAuth tokens
create table public.user_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  provider text not null default 'google',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Email processing history
create table public.email_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  gmail_id text not null,
  subject text,
  sender text,
  received_at timestamptz,
  category text,
  summary text,
  todos jsonb default '[]',
  recommended_action text check (recommended_action in ('archive','keep','draft_reply')),
  action_status text check (action_status in ('pending','approved','rejected','executed')) default 'pending',
  raw_snippet text,
  processed_at timestamptz default now()
);

-- User-defined rules (P1)
create table public.user_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  rule_text text not null,
  created_at timestamptz default now()
);
```

---

### Phase 2 — Core Gmail Tools / MCP (Day 1–2)

**Goal:** Utility layer that reads/writes Gmail, fully decoupled from API routes.

- [ ] `src/lib/mcp/gmail.ts`
  - `fetchUnreadEmails(accessToken, limit)` → `Email[]`
  - `archiveEmail(accessToken, id)` → stub returning `{ success: true }`
  - `createDraft(accessToken, to, subject, body)` → stub
- [ ] `src/lib/mcp/calendar.ts` (P1)
  - `fetchUpcomingEvents(accessToken)`
  - `createEvent(accessToken, event)`
- [ ] Add `@modelcontextprotocol/sdk` as MCP transport layer (optional / P1)

---

### Phase 3 — AI Processing Pipeline (Day 2)

**Goal:** Each email is classified, summarised, and has todos extracted concurrently.

- [ ] `src/lib/ai/processor.ts`
  - Configure Qwen via Vercel AI SDK (`createOpenAI`-compatible base URL)
  - `processEmailsBatched(emails, userRules?)` using `Promise.all`
- [ ] Structured output prompt → JSON schema:

```ts
{
  category: "newsletter" | "alert" | "personal" | "promotion" | "other";
  summary: string;          // ≤ 2 sentences
  todos: string[];          // extracted action items
  recommendedAction: "archive" | "keep" | "draft_reply";
}
```

- [ ] Use `qwen-turbo` for classification + summary, `qwen-max` for complex reasoning
- [ ] Persist results to `email_records` table via Supabase server client
- [ ] API route: `POST /api/process-emails` (calls `processEmailsBatched`, `maxDuration = 60`)

---

### Phase 4 — Frontend Dashboard (Day 3)

**Goal:** Users see their daily digest and can approve/reject AI-recommended actions.

- [ ] `src/app/dashboard/page.tsx` — server component, fetches `email_records`
- [ ] `src/components/digest/DigestSection.tsx` — renders summaries grouped by category
- [ ] `src/components/digest/EmailCard.tsx` — single email card (category badge, summary, todos)
- [ ] `src/components/hitl/ActionQueue.tsx` — lists `pending` records
- [ ] `src/components/hitl/ActionItem.tsx` — shows recommended action + Approve / Reject buttons
- [ ] API route: `POST /api/actions/approve` and `POST /api/actions/reject`
  - Update `action_status` in Supabase
  - On approve: execute `archiveEmail` or `createDraft`

---

### Phase 5 — P1 Features & Rule Engine (Day 4)

**Goal:** Users can define natural-language rules; AI respects them at classification time.

- [ ] `src/app/settings/page.tsx` — textarea to enter / edit rules
- [ ] Save rules to `user_rules` table
- [ ] Load rules in `processEmailsBatched` and inject into system prompt
- [ ] Google Calendar tool integration
- [ ] Draft reply generation prompt (use `qwen-max`)
- [ ] Auto-label / archive execution (real Gmail API calls replacing stubs)

---

## Folder Structure (Target)

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── api/
│   │   ├── process-emails/route.ts   # maxDuration = 60
│   │   └── actions/
│   │       ├── approve/route.ts
│   │       └── reject/route.ts
│   ├── dashboard/page.tsx
│   ├── settings/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── digest/
│   │   ├── DigestSection.tsx
│   │   └── EmailCard.tsx
│   └── hitl/
│       ├── ActionQueue.tsx
│       └── ActionItem.tsx
├── lib/
│   ├── ai/
│   │   └── processor.ts
│   ├── mcp/
│   │   ├── gmail.ts
│   │   └── calendar.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
└── types/
    └── email.ts
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Qwen / AI
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# Google (if managing OAuth manually outside Supabase)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Next Steps (Start Here)

1. Install shadcn/ui: `npx shadcn@latest init`
2. Install core deps: `npm install @supabase/supabase-js @supabase/ssr ai @modelcontextprotocol/sdk`
3. Create Supabase project → run Phase 1 SQL schema
4. Configure Google OAuth in Supabase dashboard
5. Build login page and verify token storage → commit
6. Proceed to Phase 2
