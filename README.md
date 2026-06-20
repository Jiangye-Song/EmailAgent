# Email Digest Agent

An AI-powered email assistant that reads your Gmail, classifies emails, extracts action items, and presents a daily digest with a Human-in-the-Loop (HITL) confirmation queue.

Built with **Next.js 16**, **Qwen Cloud AI**, **PostgreSQL + pgvector**, and **Google OAuth**.

---

## Features

- **Gmail integration** — reads unread emails via Google OAuth
- **AI classification** — categorises each email (newsletter / alert / personal / promotion / other) using `qwen3.6-flash`
- **AI summarisation** — generates a 2-sentence summary and extracts action items using `qwen3.7-plus`
- **Semantic search index** — embeds each email with `text-embedding-v4` and stores it in pgvector
- **Daily digest dashboard** — browse processed emails grouped by category
- **HITL action queue** — approve or reject AI-recommended actions (archive / draft reply) before execution

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.9+ | Required by Next.js 16 |
| npm | 10+ | Comes with Node 20 |
| Docker Desktop | any | Runs local PostgreSQL |
| Git | any | |

---

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd EmailAgent
npm install
```

### 2. Configure environment variables

Copy the example file and fill in each value:

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set:

```env
# ─── NextAuth.js v5 ───────────────────────────────────────────────────────────
AUTH_SECRET=          # generate with: npx auth secret
AUTH_GOOGLE_ID=       # from Google Cloud Console (see step 3)
AUTH_GOOGLE_SECRET=   # from Google Cloud Console (see step 3)

# ─── Local PostgreSQL (Docker) ────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_agent

# ─── Qwen Cloud ───────────────────────────────────────────────────────────────
QWEN_API_KEY=         # sk-... from https://home.qwencloud.com/api-keys
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Generate `AUTH_SECRET`:

```bash
npx auth secret
```

### 3. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`
3. Copy **Client ID** → `AUTH_GOOGLE_ID`
4. Copy **Client Secret** → `AUTH_GOOGLE_SECRET`
5. Go to **APIs & Services → OAuth consent screen → Data access → Add or remove scopes** and add:
   - `https://mail.google.com/` (Gmail full access)
   - `https://www.googleapis.com/auth/calendar` (Calendar)
6. Under **Test users**, add your Google account

### 4. Get a Qwen Cloud API key

1. Sign up at [home.qwencloud.com](https://home.qwencloud.com)
2. Go to **API Keys → Create API key**
3. Copy the key (starts with `sk-`) → `QWEN_API_KEY`

New accounts receive a free quota — no billing required to test.

### 5. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 + pgvector container and automatically applies the schema from `scripts/db/schema.sql`.

Verify all tables were created:

```bash
docker exec email-agent-postgres psql -U postgres -d email_agent -c "\dt"
```

Expected output: `accounts`, `digest_exports`, `email_records`, `sessions`, `user_rules`, `users`, `verification_tokens`

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

1. **Sign in** with your Google account — you'll be redirected to the dashboard
2. Click **Trigger Digest** — this will:
   - Fetch your 20 most recent unread Gmail messages
   - Classify each with `qwen3.6-flash`
   - Summarise + extract todos with `qwen3.7-plus`
   - Generate embeddings with `text-embedding-v4` and store them in pgvector
3. Browse the **Digest** tab — emails grouped by category with summaries and action items
4. Check the **Action Queue** tab — emails the AI flagged for archive or draft reply
5. Click **Approve** to execute the action or **Reject** to dismiss it

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth.js route handler
│   │   └── process-emails/       # POST: fetch + classify + embed + save
│   ├── dashboard/                # Main digest UI
│   └── login/                    # Google sign-in page
├── components/
│   ├── digest/                   # EmailCard, DigestSection
│   ├── hitl/                     # ActionItem, ActionQueue
│   └── dashboard/                # TriggerButton
├── lib/
│   ├── ai/
│   │   ├── qwen.ts               # Qwen Cloud clients (flash / plus / max / embed)
│   │   └── processor.ts          # processEmailsBatched(), saveDailyDigest()
│   ├── mcp/
│   │   ├── gmail.ts              # fetchUnreadEmails, archiveEmail, createDraft
│   │   └── calendar.ts           # fetchUpcomingEvents, createEvent (stubs)
│   ├── actions/
│   │   └── email-actions.ts      # Server actions: approveAction, rejectAction
│   ├── auth.ts                   # NextAuth config (Google + pg adapter)
│   ├── db.ts                     # pg.Pool singleton
│   └── tokens.ts                 # getGoogleAccessToken() with auto-refresh
├── types/
│   ├── email.ts                  # Email, ProcessedEmail types
│   └── db.ts                     # EmailRecord DB row type
scripts/
└── db/
    └── schema.sql                # Full PostgreSQL schema (auto-applied by Docker)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Auth | NextAuth.js v5 + Google OAuth + `@auth/pg-adapter` |
| Database | PostgreSQL 16 + pgvector (Docker locally, PolarDB in production) |
| AI — Classification | Qwen Cloud `qwen3.6-flash` |
| AI — Summarisation | Qwen Cloud `qwen3.7-plus` |
| AI — Reasoning | Qwen Cloud `qwen3.7-max` |
| AI — Embeddings | Qwen Cloud `text-embedding-v4` (1024-dim) |
| UI | Tailwind CSS 4, shadcn/ui, Lucide Icons |

---

## Troubleshooting

**`AUTH_SECRET` missing error on startup**
Run `npx auth secret` and paste the output into `.env.local` as `AUTH_SECRET=<value>`.

**`expected 1024 dimensions, not X` pgvector error**
The embedding column must be `vector(1024)`. Run:
```bash
docker exec email-agent-postgres psql -U postgres -d email_agent \
  -c "ALTER TABLE email_records ALTER COLUMN embedding TYPE vector(1024);"
```

**`must contain the word 'json'` error from Qwen**
All `generateObject` system prompts must include the word "JSON". This is already handled in `processor.ts`.

**`No object generated: response did not match schema`**
Qwen returned JSON but with different field names. The system prompts in `processor.ts` include explicit field descriptions to prevent this.

**Gmail returns 401**
Your access token has expired and refresh failed. Sign out and sign back in to get a fresh token.

**Docker container not starting**
Ensure Docker Desktop is running, then:
```bash
docker compose down -v
docker compose up -d
```


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
