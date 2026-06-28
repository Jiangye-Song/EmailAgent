# Email Digest Agent — Project Plan

## Hackathon Submission Checklist

- [ ] Public GitHub repo with open source license (MIT) visible in About section
- [ ] Alibaba Cloud deployment proof (`docs/alibaba-cloud-proof.md` + recording)
- [ ] Architecture diagram (see below)
- [ ] 3-minute demo video (YouTube / Vimeo)
- [ ] Text description of features
- [ ] Track identified: **Productivity & Automation** (AI-powered email workflow)
- [ ] Blog / Social post (optional, for Blog Post Prize)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router), React 19, TypeScript 5 |
| Styling & UI | Tailwind CSS, shadcn/ui, Lucide Icons |
| Auth & All DB | **Alibaba Cloud PolarDB for PostgreSQL** (single source of truth) |
| Auth Framework | **NextAuth.js v5 (Auth.js)** + Credentials provider (email/password) + PolarDB adapter |
| Email Service | **emailagent.top domain** + **Resend API** (send notifications) |
| Inbound Emails | **Cloudflare Email Router** → webhook → `/api/inbound` (user auto-forwards to service email) |
| File Storage | **Alibaba Cloud OSS** — Phase 2 only (Phase 1 stores attachment URLs + digest JSON in PolarDB) |
| Backend Hosting | **Alibaba Cloud Function Compute 3.0** (Next.js standalone) |
| Container Registry | **Alibaba Cloud ACR** (Docker image store) |
| AI — Fast tasks | **Qwen Cloud `qwen3.6-flash`** (classification, quick summaries) |
| AI — Balanced | **Qwen Cloud `qwen3.7-plus`** (summarization, todo extraction, drafts) |
| AI — Reasoning | **Qwen Cloud `qwen3.7-max`** (rule evaluation, calendar parsing) |
| AI — Embeddings | **Qwen Cloud `text-embedding-v4`** (semantic email search) |
| Tooling Protocol | `@modelcontextprotocol/sdk` (Gmail / Calendar tools) |

**Qwen Cloud API Base URL (International):** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`

**Runtime Requirement:** Node.js 20.9+ (Next.js 16 minimum; Node 18 is not supported).

**Architecture Constraint:** Core logic must be decoupled from API Route handlers (keeps the codebase portable and testable). Use `Promise.all` for concurrent email processing. No `maxDuration` cap applies — Alibaba Cloud Function Compute supports timeouts up to 24 hours, far exceeding Vercel's 60 s limit.

**Next.js 16 Key Patterns to Follow:**
- `proxy.ts` instead of `middleware.ts` (middleware is deprecated in v16; proxy runs Node.js runtime only, no Edge)
- All Request APIs are async: `await cookies()`, `await headers()`, `await params`, `await searchParams`
- Use `"use cache"` directive on Server Components / functions that should be cached (replaces PPR)
- `cacheTag()` / `cacheLife()` are stable (no `unstable_` prefix)
- `turbopack` config is top-level in `next.config.ts` (not under `experimental`)
- `output: "standalone"` in `next.config.ts` for Docker/Function Compute deployment
- Linting: use `eslint` CLI directly — `next lint` is removed in v16
- Run `npx next typegen` to generate `PageProps` / `LayoutProps` type helpers after adding routes

---

```mermaid
graph TB
    subgraph UserMail["User's Email App"]
        INBOX[User's Inbox\ne.g., Gmail, Outlook]
    end

    subgraph ServiceEmail["emailagent.top Domain"]
        SVC_EMAIL["Service Email\ninbox@emailagent.top"]
    end

    subgraph Cloudflare["Cloudflare Email Router"]
        CF_ROUTER["Email Router\n(catches inbound to emailagent.top)"]
        CF_WORKER["Cloudflare Worker\nemail-worker.ts"]
    end

    subgraph Client["Browser / Client"]
        UI[Next.js Frontend\nDashboard + HITL Queue]
    end

    subgraph AliyunFC["Alibaba Cloud Function Compute 3.0"]
        API_INBOUND[POST /api/inbound\nreceives emails]
        API_APR[POST /api/actions/approve]
        API_REJ[POST /api/actions/reject]
        LIB_PROC[lib/ai/processor.ts]
    end

    subgraph QwenCloud["Qwen Cloud (DashScope Intl.)"]
        M_FLASH[qwen3.6-flash\nClassification]
        M_PLUS[qwen3.7-plus\nSummarize + Todos]
        M_MAX[qwen3.7-max\nRule Engine]
        M_EMBED[text-embedding-v4\nSemantic Search]
    end

    subgraph AliyunData["Alibaba Cloud Data"]
        POLAR[(PolarDB PostgreSQL\nusers, email_records, user_rules)]
        OSS[OSS Bucket\nAttachments + Exports]
    end

    INBOX -->|User auto-forwards| SVC_EMAIL
    SVC_EMAIL -->|Cloudflare MX Records| CF_ROUTER
    CF_ROUTER --> CF_WORKER
    CF_WORKER -->|webhook| API_INBOUND
    API_INBOUND --> LIB_PROC
    LIB_PROC -->|Promise.all| M_FLASH
    LIB_PROC -->|summarize| M_PLUS
    LIB_PROC -->|rules| M_MAX
    LIB_PROC -->|index| M_EMBED
    LIB_PROC --> POLAR
    LIB_PROC --> OSS
    UI -->|HTTPS| AliyunFC
    UI -->|NextAuth.js email/pwd| POLAR
    POLAR --> API_APR
    POLAR --> API_REJ
```

---

## Feature Priorities

### P0 — Must Have

- [x] **Email/Password Registration** — Sign up with email + password (hashed in PolarDB)
- [x] **Email/Password Sign In** — Login via NextAuth.js credentials provider
- [x] **Forwarding Email Address** — Each user gets a unique address like `user_<id>@emailagent.top`
- [x] **Inbound Email Webhook** — Cloudflare Email Router → `/api/inbound` receives forwarded emails
- [x] **User Authorization Check** — Verify forwarding sender is authorized (by email address or domain whitelist) _(enforced in `/api/inbound`; non-whitelisted senders are skipped)_
- [x] **Email Classification** — Categorize via `qwen3.6-flash` (Newsletter / Alert / Personal / Promotion / Other)
- [x] **Email Summarization** — Generate 2-sentence summary + action items via `qwen3.7-plus`
- [x] **Semantic Search Index** — Embed with `text-embedding-v4`, store in PolarDB pgvector
- [x] **Inbox Dashboard** — Browse processed emails grouped by category + sender
- [x] **HITL Confirmation Queue** — Approve / Reject AI-recommended actions before execution

### P1 — Bonus

- [x] **User-Defined Rules Engine** — `qwen3.7-max` evaluates rules against each email
  - "Always keep emails from {domain}"
  - "Archive promotional emails automatically"
  - "Flag emails related to {keywords}"
- [ ] **Auto-Label / Archive** — Execute approved actions via Gmail API (if user connects Gmail separately)
- [ ] **Auto-generate Reply Drafts** — `qwen3.7-plus` suggests responses _(`draft_body` column + UI exist; generation not yet implemented in processor)_
- [ ] **Semantic Email Search** — Full-text + vector search across archived emails
- [ ] **OSS Export** — Move digest JSON from `digest_exports` table → Alibaba Cloud OSS

### P2 — Advanced / Backlog

- [ ] **Multi-service email support** — Let users connect their own Gmail/Outlook inboxes
- [ ] **CRM integration** — Link contacts to email senders
- [ ] **Slack digest export** — Daily summary sent to Slack
- [ ] **Team / shared inboxes** — Multi-user support

---

## Execution Phases

### Phase 1 — Infrastructure & Auth (Day 1)

**Goal:** Users can register/sign in with email & password; each user gets a unique service email address.

- [x] Initialize Next.js 16 project (TypeScript, Tailwind 4, App Router, `src/` dir, Turbopack default)
- [x] Initialize git repository
- [x] Add MIT License (`LICENSE` file) — required for hackathon
- [x] Install and configure shadcn/ui
- [x] Provision local Docker PostgreSQL + pgvector (mirrors PolarDB; swap connection string for PolarDB in Phase 6)
- [x] **Configure NextAuth.js v5 with Credentials provider** (NOT Google OAuth):
  - [x] `src/auth.ts` — Credentials provider with email + password verification via bcryptjs
  - [x] Session strategy: JWT (required for credentials provider)
- [x] Run schema (NextAuth tables + application tables — see below)
- [x] Implement registration page (`src/app/register/page.tsx`):
  - [x] Form: email + password + confirm password
  - [x] Client-side validation + server `POST /api/auth/register`
  - [x] Hash password (bcrypt cost 12) → insert into DB
  - [x] Seed `sender_whitelist` with the registration email (default trusted forwarding sender)
  - [x] Redirect to `/login?registered=1` on success
- [x] Implement login page (`src/app/login/page.tsx`):
  - [x] Email/password form using credentials provider
  - [x] Redirect to `/inbox` on success
- [x] **Forwarding Email Address** (`src/lib/email/forwarding-address.ts`):
  - [x] `ensureForwardingAddress(userId)` — idempotent, generates `<prefix>@<INBOUND_DOMAIN>`
  - [x] Stored in `users.forwarding_address` (unique constraint)
  - [x] Auto-generated on registration
- [x] Update `proxy.ts` to protect `/inbox` and `/settings` routes (redirect to `/login`)
- [x] **`ForwardingInfo` component** (`src/components/settings/ForwardingInfo.tsx`):
  - [x] Copy-to-clipboard button
  - [x] Step-by-step instructions for Gmail, Outlook, Apple Mail
- [x] Updated settings page to show forwarding address (removed old IMAP section)

**Alibaba Cloud PolarDB Schema (single DB — all tables, with changes for email/password auth):**

```sql
-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists vector;   -- semantic search
create extension if not exists "uuid-ossp";

-- ─── NextAuth.js v5 tables (@auth/pg-adapter) ────────────────────────────────
create table users (
  id uuid primary key default uuid_generate_v4(),
  name text,
  email text unique not null,
  "emailVerified" timestamptz,
  image text,
  password_hash text,                    -- NEW: bcrypt hash for credentials provider
  forwarding_address text unique,        -- NEW: unique email for this user (user_<id>@emailagent.top)
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default uuid_generate_v4(),
  "sessionToken" text unique not null,
  "userId" uuid not null references users(id) on delete cascade,
  expires timestamptz not null
);

create table verification_tokens (
  identifier text not null,
  token text not null,
  expires timestamptz not null,
  primary key (identifier, token)
);

-- ─── Application tables ──────────────────────────────────────────────────────
create table email_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  message_id text not null,              -- CHANGED: from gmail_id → message_id (Cloudflare email ID)
  subject text,
  sender text not null,                  -- email address of person who forwarded to us
  received_at timestamptz not null,
  category text,
  summary text,
  todos jsonb default '[]',
  recommended_action text check (recommended_action in ('archive','keep','draft_reply')),
  action_status text check (action_status in ('pending','approved','rejected','executed')) default 'pending',
  raw_body text,                         -- email body
  embedding vector(1536),                -- text-embedding-v4 output
  attachment_urls jsonb default '[]',    -- file attachments from forwarded email
  processed_at timestamptz default now()
);

create index on email_records using hnsw (embedding vector_cosine_ops);
create index on email_records (user_id);
create index on email_records (received_at);

-- Daily digest exports (JSONB payload)
create table digest_exports (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, date)
);

-- User-defined rules for email filtering
create table user_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  rule_text text not null,
  created_at timestamptz default now()
);

-- NEW: Authorization whitelist — which senders can forward to each user's address
create table sender_whitelist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  sender_email text not null,            -- e.g., "john@company.com"
  sender_domain text,                    -- e.g., "company.com" (optional, for domain-wide matching)
  created_at timestamptz default now(),
  unique (user_id, sender_email)
);
```

---

### Phase 2 — Inbound Email Webhook & Parser (Day 2)

**Goal:** Emails forwarded to `emailagent.top` are received, parsed, and attributed to the correct user.

- [ ] **Cloudflare Email Routing Setup** (outside Next.js, in Cloudflare console):
  - [ ] Add MX records for `emailagent.top` to Cloudflare
  - [ ] Create Email Routing rule: `*@emailagent.top` → forwards to a catch-all address
  - [ ] Set up webhook to send inbound emails as POST to `/api/inbound`
  
- [x] `cloudflare/email-worker.ts` — Cloudflare Worker (deployed separately):
  - [x] Receives raw MIME email from Cloudflare Email Routing
  - [x] Forwards as HTTP POST to `https://emailagent.top/api/inbound` with raw email body
  - [x] Includes signature verification (HMAC-SHA256 using CF_INBOUND_SECRET)

- [x] `src/lib/email/parser.ts` — Parse raw MIME email:
  - [x] Use `mailparser` library to convert MIME buffer → `{ subject, from, to, text, html, attachments }`
  - [x] Extract attachments (store URLs only in Phase 1)

- [x] `src/app/api/inbound/route.ts` — Webhook receiver:
  - [x] Validate CF_INBOUND_SECRET via HMAC
  - [x] Parse email via `parseMimeEmail()`
  - [x] Look up user by forwarding address (extract `user_abc123@emailagent.top` → find user)
  - [x] Check sender authorization: is sender in `sender_whitelist` for this user?
    - If NOT: skip processing, log event
    - If YES: proceed
  - [x] Store raw email in `email_records` (with user_id, sender, subject, body)
  - [x] **Enqueue async job** (or call processor directly):
    - Classify, summarize, embed (Phase 3)
    - Save pending action to action queue
  - [x] Return `200 OK` immediately to Cloudflare

- [x] `src/lib/email/forwarding-address.ts` — Enhanced:
  - [x] Add `getUserByForwardingAddress(address)` — fast lookup for `/api/inbound`
  - [x] Add whitelist helpers (`addSenderWhitelistEntry`, `addSenderWhitelistDomain`, `removeSenderWhitelistEntry`, `isSenderWhitelisted`)

**Files to Create:**
- `cloudflare/email-worker.ts` (deployed to Cloudflare, not part of Next.js build)
- `src/lib/email/parser.ts`
- `src/app/api/inbound/route.ts`
- `src/lib/email/forwarding-address.ts`

---

### Phase 3 — AI Processing Pipeline (Day 2–3)

**Goal:** Each inbound email is classified, summarized, and indexed concurrently using multiple Qwen models.

- [x] `src/lib/ai/qwen.ts` — shared Qwen client:
  - Base URL: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
  - Export three clients: `qwenFlash`, `qwenPlus`, `qwenMax`, `qwenEmbedding`

- [x] `src/lib/ai/processor.ts` — Main processing pipeline:
  - `processEmailBatch(emailRecords, userId, userRules?)` using `Promise.allSettled`
  - Per email pipeline (steps 1–4 run concurrently via `Promise.all`):
    1. **`qwen3.6-flash`** → classify category (Newsletter / Alert / Personal / Promotion / Other)
    2. **`qwen3.7-plus`** → summarize (≤2 sentences) + extract todos + recommended action
    3. **`text-embedding-v4`** → generate 1024-dim embedding for semantic search
    4. *(if rules exist)* **`qwen3.7-max`** → evaluate user rules against email body/sender
  - Update `email_records` with `(category, summary, todos, recommended_action, embedding, action_status='pending')`
  - Structured output (Zod schema):
    ```ts
    {
      category: "newsletter" | "alert" | "personal" | "promotion" | "other";
      summary: string;             // ≤ 2 sentences
      todos: string[];             // extracted action items
      recommendedAction: "archive" | "keep" | "draft_reply";
      ruleMatches?: string[];      // matched user rules (if any)
    }
    ```
  - [ ] Draft reply generation (`draft_body`) — column + UI exist, not yet generated
  - [ ] Calendar event extraction (`calendar_events`) — column + UI exist, not yet generated

- [x] **Called from `/api/inbound`** after email is stored with raw body
  - Synchronous (Alibaba Function Compute timeout is generous)

**Files to Create/Update:**
- `src/lib/ai/processor.ts` (refactored from v1 to work with inbound emails)
- `src/types/email.ts` (if not already done)

---

### Phase 4 — Inbox Dashboard & HITL Queue (Day 3)

**Goal:** Users see their forwarded emails organized by category with approval/rejection actions.

- [x] `src/app/inbox/page.tsx` — server component:
  - Fetch `email_records` for logged-in user, ordered by `received_at DESC`
  - Build category counts (newsletter, alert, personal, promotion, other)
  - Pass to `InboxLayout` client component

- [x] `src/components/inbox/InboxLayout.tsx` — client wrapper:
  - Owns category filter state (selected category)
  - Renders sidebar + email list + email detail panels

- [x] `src/components/inbox/InboxSidebar.tsx` — category filter:
  - Show counts: "Newsletters (5)", "Alerts (2)", etc.
  - Click to filter email list

- [x] `src/components/inbox/EmailList.tsx` — scrollable email list:
  - Show preview: from, subject, 1-line summary
  - Highlight pending actions (yellow badge)
  - Click to select + show in detail pane

- [x] `src/components/inbox/EmailDetail.tsx` — reading pane:
  - Full sender, subject, body, summary, todos
  - Show category badge
  - Collapsible original email body (`raw_body`)
  - Draft reply preview, calendar events, ICS download button
  - If action is `pending`: show **Approve / Reject buttons**
    - Approve: execute recommended action (archive, draft reply)
    - Reject: dismiss action, mark as `rejected`

- [x] `src/lib/actions/email-actions.ts` — server actions:
  - `approveAction(emailId)` → update `action_status = 'approved'`
  - `rejectAction(emailId)` → update `action_status = 'rejected'` → revalidate `/inbox`

- [x] Add to `proxy.ts`: protect `/inbox` route (redirect to `/login`)

**Files to Create:**
- `src/app/inbox/page.tsx`
- `src/components/inbox/InboxLayout.tsx`
- `src/components/inbox/InboxSidebar.tsx`
- `src/components/inbox/EmailList.tsx`
- `src/components/inbox/EmailDetail.tsx`
- `src/lib/actions/email-actions.ts` (new file)

---

### Phase 5 — Settings & User Rules Engine (Day 4)

**Goal:** Users can define natural-language rules and manage sender whitelists.

- [x] `src/app/settings/page.tsx` — server component:
  - Show user's forwarding email address: `user_abc123@emailagent.top`
  - Instructions: "Add this to auto-forward in your email app"
  - Textarea to enter/edit rules (natural language, e.g., "Archive all newsletters")
  - List of authorized senders (manage whitelist)

- [x] `src/components/settings/RulesEditor.tsx` — rule management UI:
  - Add / edit / delete rules
  - Save rules to `user_rules` table

- [x] `src/components/settings/ForwardingInfo.tsx` — done in Phase 1:
  - Display user's unique forwarding address
  - Copy-to-clipboard button
  - Show instructions for popular email providers (Gmail, Outlook, Apple Mail)

- [x] `src/components/settings/SenderWhitelist.tsx` — NEW:
  - List of approved senders
  - Add new sender (email or domain)
  - Remove sender

- [x] Enhance `/api/inbound` sender authorization:
  - Check `sender_whitelist` table for sender email
  - If not in whitelist: skip processing and log event
  - Domain-based whitelist matching supported

- [x] Enhance `processEmailBatch()`:
  - Load user rules from `user_rules` table
  - Pass rules + email body to `qwen3.7-max`
  - Get back `ruleMatches[]` (which rules triggered)

- [ ] *(Bonus)* Add "auto-approve" settings:
  - "Auto-archive newsletters"
  - "Auto-keep personal emails from whitelisted senders"

**Files to Update/Create:**
- `src/app/settings/page.tsx` (rewrite to support new flow)
- `src/components/settings/RulesEditor.tsx` (update)
- `src/components/settings/ForwardingInfo.tsx` (new)
- `src/components/settings/SenderWhitelist.tsx` (new)
- Update `/api/inbound` for whitelist checks

**Implementation note (forwarding model):** Sender whitelist entries represent forwarding sender mailboxes (the address configured to auto-forward into `emailagent.top`), not original recipients in an email thread.

---

### Phase 6 — Alibaba Cloud Deployment (Day 4–5)

**Goal:** Backend running on Alibaba Cloud with proof for hackathon submission.

- [ ] **Domain Setup:**
  - [ ] Add MX records for `emailagent.top` → Cloudflare Email Routing
  - [ ] Configure Cloudflare Email Routing to forward to worker/webhook
  - [ ] SSL certificate for `emailagent.top` (free or purchased)

- [ ] **Container Image:**
  - [x] Ensure `next.config.ts` has `output: "standalone"`
  - [ ] Create `Dockerfile` for Next.js standalone deployment
  - [ ] Build image: `docker build -t email-agent:latest .`

- [ ] **Push to Alibaba Cloud ACR:**
  - [ ] Create ACR repo in Alibaba Cloud console
  - [ ] Tag image: `docker tag email-agent:latest <registry>/email-agent:latest`
  - [ ] Push: `docker push <registry>/email-agent:latest`

- [ ] **Deploy to Function Compute 3.0:**
  - [ ] Create custom container runtime function
  - [ ] Set image URI to ACR image
  - [ ] Environment variables:
    - `DATABASE_URL=postgresql://...@<polardb-endpoint>:5432/email_agent`
    - `QWEN_API_KEY=...`
    - `NEXTAUTH_SECRET=...`
    - `NEXTAUTH_URL=https://emailagent.top`
    - `CF_INBOUND_SECRET=...` (shared secret with Cloudflare worker)
  - [ ] Configure HTTP trigger for public access
  - [ ] Set timeout to 60+ seconds for email processing

- [x] **Cloudflare Worker Deployment:**
  - [x] Deploy `cloudflare/email-worker.ts` to Cloudflare Workers
  - [x] Update webhook URL to point to FC function `/api/inbound`
  - [ ] Test end-to-end email forwarding

- [ ] **Database Migration:**
  - [ ] Provision Alibaba Cloud PolarDB cluster (PostgreSQL-compatible)
  - [ ] Run full schema against PolarDB
  - [ ] Update `DATABASE_URL` in Function Compute environment

- [ ] **Create `docs/alibaba-cloud-proof.md`:**
  - Document deployed FC function URL
  - Include screenshot of FC console showing running function
  - Include test API call proving `/api/inbound` is live
  - List PolarDB endpoint + user count
  - Link to email_agent.top domain

- [ ] *(Bonus)* Record video:
  - Register new account on deployed site
  - Show forwarding address
  - Send test email to service address
  - Show email appear in inbox dashboard
  - Show AI classification + summary working

**Files to Create:**
- `Dockerfile`
- `cloudflare/email-worker.ts` (if not already deployed)

---

## Folder Structure (Target)

```
├── cloudflare/
│   └── email-worker.ts              # Cloudflare Worker for email forwarding
├── docs/
│   └── alibaba-cloud-proof.md
├── Dockerfile
├── LICENSE
├── next.config.ts                   # output: standalone, turbopack top-level
├── proxy.ts                         # Next.js 16: proxy.ts (not middleware.ts)

src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # Sign in with email/password
│   │   └── register/page.tsx        # NEW: Sign up with email/password
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth credentials provider
│   │   ├── inbound/route.ts              # NEW: Webhook for forwarded emails
│   │   └── actions/
│   │       ├── approve/route.ts
│   │       └── reject/route.ts
│   ├── inbox/page.tsx               # Main email dashboard
│   ├── settings/page.tsx            # User settings + forwarding address + rules
│   ├── layout.tsx
│   └── page.tsx                     # Redirect to /inbox or /login

├── components/
│   ├── inbox/
│   │   ├── InboxLayout.tsx          # Main layout
│   │   ├── InboxSidebar.tsx         # Category filter
│   │   ├── EmailList.tsx            # Email list pane
│   │   └── EmailDetail.tsx          # Reading pane + HITL actions
│   └── settings/
│       ├── RulesEditor.tsx          # Rule management
│       ├── ForwardingInfo.tsx       # NEW: Show forwarding address
│       └── SenderWhitelist.tsx      # NEW: Manage authorized senders

├── lib/
│   ├── ai/
│   │   ├── qwen.ts                  # Qwen Cloud clients
│   │   └── processor.ts             # Email classification pipeline
│   ├── email/
│   │   ├── parser.ts                # Parse MIME email
│   │   └── forwarding-address.ts    # Generate/lookup user addresses
│   ├── actions/
│   │   └── email-actions.ts         # Server actions (approve/reject)
│   ├── oss.ts                       # Alibaba Cloud OSS (Phase 2+)
│   ├── db.ts
│   └── auth.ts                      # NextAuth.js v5 with credentials provider

├── types/
│   ├── email.ts
│   └── next-auth.d.ts
```

---

## Environment Variables

```env
# ─── NextAuth.js v5 (Credentials Provider) ────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000                    # Change to domain in production
NEXTAUTH_SECRET=                                      # openssl rand -base64 32

# ─── Qwen Cloud (International endpoint) ──────────────────────────────────────
QWEN_API_KEY=                                         # sk-... from home.qwencloud.com/api-keys
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# ─── PostgreSQL (Local Docker in dev, Alibaba PolarDB in prod) ────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_agent

# ─── Cloudflare Email Webhook Secret ──────────────────────────────────────────
CF_INBOUND_SECRET=                                    # Shared secret for HMAC validation (random string)

# ─── Alibaba Cloud (Phase 2+) ────────────────────────────────────────────────
# ALIYUN_ACCESS_KEY_ID=
# ALIYUN_ACCESS_KEY_SECRET=
# ALIYUN_OSS_REGION=oss-ap-southeast-1
# ALIYUN_OSS_BUCKET=email-agent-assets
```

---

## Next Steps (Start Here)

### Phase 1 Setup (Day 1):

1. **Install dependencies:**
   ```bash
   npm install bcryptjs mailparser
   npm install -D @types/mailparser
   ```

2. **Update `src/auth.ts`:**
   - Remove Google provider
   - Add Credentials provider with email/password verification
   - Password hashing: use `bcryptjs` for secure hashing

3. **Create registration page** (`src/app/register/page.tsx`):
   - Form: email + password + confirm
   - Hash password → insert to DB
   - Validate uniqueness

4. **Create `src/lib/email/forwarding-address.ts`:**
   - `ensureForwardingAddress(userId)` — generates `user_<short_id>@emailagent.top`
   - Store in `users.forwarding_address`

5. **Add to database schema:**
   - Add `password_hash text` column to `users` table
   - Add `forwarding_address text unique` column to `users` table
   - Create `sender_whitelist` table for authorization

6. **Update `proxy.ts`:**
   - Protect `/inbox` and `/settings` routes

7. **Update login page** (`src/app/login/page.tsx`):
   - Use Credentials provider (email/password form)

8. **Verify locally:**
   - Register user
   - Sign in
   - Check `forwarding_address` is generated and displayed

### Phase 2 Setup (Day 2):

9. **Set up Cloudflare Email Routing** (outside Next.js):
   - Add MX records for `emailagent.top`
   - Configure catch-all rule + webhook

10. **Create `src/lib/email/parser.ts`:**
    - Use `mailparser` to parse MIME → `{ subject, from, to, text, html, attachments }`

11. **Create `/api/inbound` webhook handler:**
    - Validate CF_INBOUND_SECRET
    - Parse email
    - Lookup user by forwarding address
    - Check sender whitelist
    - Store in `email_records`

12. **Get Qwen Cloud API key:**
    - Sign up at [home.qwencloud.com](https://home.qwencloud.com)
    - Create API key → `QWEN_API_KEY`

### Phase 3+ Setup (Days 2–5):

13. Complete phases 3–6 per PLAN.md above
14. Deploy to Alibaba Cloud
15. Update domain DNS + SSL
16. Record demo video for hackathon submission

---

## Qwen Model Usage Summary

| Model | Use Case | Why |
|---|---|---|
| `qwen3.6-flash` | Email category classification | Cheapest + fastest, simple task |
| `qwen3.7-plus` | Summarization, todo extraction, draft replies | Best cost/performance balance |
| `qwen3.7-max` | Rule evaluation, calendar parsing, complex reasoning | Highest accuracy for agent tasks |
| `text-embedding-v4` | Semantic search index over processed emails | Native Qwen embedding model |
