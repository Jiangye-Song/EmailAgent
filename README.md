# Email Digest Agent

An AI-powered email assistant that receives forwarded emails, classifies them, extracts action items, and presents a digest with a Human-in-the-Loop (HITL) confirmation queue.

Built with **Next.js 16**, **Qwen Cloud AI**, **PostgreSQL + pgvector**, and **Cloudflare Email Routing**.

---

## How it works

1. Register an account → get a unique forwarding address (e.g. `abc12345@emailagent.top`)
2. Add that address to the auto-forward settings in your email app (Gmail, Outlook, etc.)
3. Every email forwarded there is classified, summarised, and embedded by Qwen AI
4. Browse your inbox dashboard — approve or reject AI-recommended actions

---

## Features

- **Email forwarding inbox** — receive emails via auto-forward, no OAuth required
- **AI classification** — categorises each email (newsletter / alert / personal / promotion / other) using `qwen3.6-flash`
- **AI summarisation** — generates a 2-sentence summary and extracts action items using `qwen3.7-plus`
- **Semantic search index** — embeds each email with `text-embedding-v4` and stores in pgvector
- **Inbox dashboard** — browse emails grouped by category with summaries and todos
- **HITL action queue** — approve or reject AI-recommended actions before execution
- **User-defined rules** — write plain-language rules evaluated by `qwen3.7-max`

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20.9+ | Required by Next.js 16 |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker Desktop | any | Runs local PostgreSQL + pgvector |
| Git | any | |

---

## Local Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd EmailAgent
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
# ─── NextAuth.js v5 ───────────────────────────────────────────────────────────
AUTH_SECRET=          # generate with: npx auth secret

# ─── Local PostgreSQL (Docker) ────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_agent

# ─── Qwen Cloud ───────────────────────────────────────────────────────────────
QWEN_API_KEY=         # sk-... from https://home.qwencloud.com/api-keys
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# ─── Email forwarding ─────────────────────────────────────────────────────────
INBOUND_DOMAIN=emailagent.top   # domain used to generate per-user forwarding addresses
CF_INBOUND_SECRET=              # any random string — must match the Cloudflare Worker secret

# ─── Web Push (optional — skip for basic local testing) ───────────────────────
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

Generate `AUTH_SECRET`:

```bash
npx auth secret
```

Generate a random `CF_INBOUND_SECRET` (any strong string, e.g. output of):

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 3. Get a Qwen Cloud API key

1. Sign up at [home.qwencloud.com](https://home.qwencloud.com)
2. Go to **API Keys → Create API key**
3. Copy the key (starts with `sk-`) → `QWEN_API_KEY`

New accounts receive a free quota — no billing required to test.

### 4. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 + pgvector and automatically applies the schema from `scripts/db/schema.sql`.

Verify all tables were created:

```bash
docker exec email-agent-postgres psql -U postgres -d email_agent -c "\dt"
```

Expected tables: `digest_exports`, `email_records`, `sender_whitelist`, `sessions`, `user_rules`, `users`, `verification_tokens`

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Register and get your forwarding address

1. Go to [http://localhost:3000/register](http://localhost:3000/register)
2. Create an account with email + password
3. Go to **Settings** — your unique forwarding address is shown (e.g. `abc12345@emailagent.top`)

> **Note:** For local testing you can simulate an inbound email without Cloudflare setup — see [Testing inbound emails locally](#testing-inbound-emails-locally) below.

---

## Testing inbound emails locally

There are two options: a quick `curl` test, or a full end-to-end flow via a Cloudflare Tunnel.

### Option A — Direct curl (no Cloudflare needed)

POST a raw email directly to your local dev server:

```bash
curl -X POST http://localhost:3000/api/inbound \
  -H "Content-Type: message/rfc822" \
  -H "X-CF-Secret: <your CF_INBOUND_SECRET from .env.local>" \
  -H "X-Recipient: <your forwarding address e.g. abc12345@emailagent.top>" \
  --data-binary @- <<'EOF'
From: sender@example.com
To: abc12345@emailagent.top
Subject: Test email
Date: Sat, 28 Jun 2026 12:00:00 +0000
Message-ID: <test-001@example.com>

Hello! This is a test email for the AI digest agent.
Please classify, summarise, and extract any action items.
EOF
```

A successful response looks like `{"ok":true,"processed":1}` and the email will appear in your inbox dashboard.

### Option B — Real email forwarding via Cloudflare Tunnel

This option lets you use actual Gmail auto-forwarding so real emails hit your local app.

**Prerequisites:** [Cloudflare account](https://cloudflare.com), domain on Cloudflare DNS, `wrangler` and `cloudflared` CLI tools installed.

#### 1. Install CLIs

```powershell
pnpm add -g wrangler
winget install Cloudflare.cloudflared
```

#### 2. Create a persistent tunnel

```powershell
cloudflared tunnel login
cloudflared tunnel create emailagent-dev

# Route a subdomain to the tunnel (uses your Cloudflare-managed domain)
cd cloudflare
cloudflared tunnel route dns emailagent-dev dev.emailagent.top
```

#### 3. Start the tunnel (run alongside `pnpm dev`)

```powershell
cloudflared tunnel run --url http://localhost:3000 emailagent-dev
```

Your local app is now reachable at `https://dev.emailagent.top`.

#### 4. Deploy the Cloudflare Email Worker

```powershell
cd cloudflare

# Set the shared secret (must match CF_INBOUND_SECRET in .env.local)
wrangler secret put CF_INBOUND_SECRET
# → type your secret value when prompted

# Deploy the worker
wrangler deploy
```

The `INBOUND_URL` in `cloudflare/wrangler.toml` should be `https://dev.emailagent.top/api/inbound`. Update it if needed and re-run `wrangler deploy`.

#### 5. Set up Cloudflare Email Routing

In the [Cloudflare dashboard](https://dash.cloudflare.com) for your domain:

1. Go to **Email → Email Routing → Get started** — this auto-adds MX records
2. Go to **Routing Rules → Catch-all** → set action to **Send to Worker** → select `email-agent-worker`
3. Save

#### 6. Configure Gmail auto-forward

1. In Gmail → **Settings (⚙) → See all settings → Forwarding and POP/IMAP**
2. Click **Add a forwarding address** → enter your address from the Settings page (e.g. `abc12345@emailagent.top`)
3. Confirm the verification email that arrives in your inbox dashboard
4. Set **Forward a copy of incoming mail** and save

Send yourself a test email — it should appear in your local inbox dashboard within seconds.

---

## Project Structure

```
cloudflare/
├── email-worker.ts     # Cloudflare Email Worker — receives inbound emails, POSTs to /api/inbound
└── wrangler.toml       # Worker config (INBOUND_URL, secrets)

scripts/
└── db/
    └── schema.sql      # Full PostgreSQL schema (auto-applied by Docker init)

src/
├── app/
│   ├── register/       # Sign-up page (email + password)
│   ├── login/          # Sign-in page
│   ├── inbox/          # Main email dashboard
│   ├── settings/       # Forwarding address + AI rules
│   └── api/
│       ├── auth/       # NextAuth.js route handler + /register endpoint
│       └── inbound/    # POST: receive forwarded email → AI pipeline
├── components/
│   ├── inbox/          # InboxLayout, InboxSidebar, EmailList, EmailDetail
│   └── settings/       # ForwardingInfo, RulesEditor
├── lib/
│   ├── ai/
│   │   ├── qwen.ts     # Qwen Cloud clients (flash / plus / max / embed)
│   │   └── processor.ts# processEmailsBatched() — classify + summarise + embed
│   ├── email/
│   │   ├── parser.ts   # Parse raw MIME email → Email object
│   │   └── forwarding-address.ts  # Generate/lookup per-user @emailagent.top addresses
│   ├── actions/
│   │   └── email-actions.ts  # Server actions: approveAction, rejectAction
│   ├── db.ts           # pg.Pool singleton
│   └── push/
│       └── notify.ts   # Web Push notifications (optional)
└── types/
    ├── email.ts        # Email, ProcessedEmail types
    └── db.ts           # EmailRecord, CalendarEvent DB row types
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Auth | NextAuth.js v5 — Credentials provider (email/password) + JWT sessions |
| Database | PostgreSQL 16 + pgvector (Docker locally, Alibaba Cloud PolarDB in production) |
| Email ingestion | Cloudflare Email Routing → Cloudflare Worker → `/api/inbound` |
| AI — Classification | Qwen Cloud `qwen3.6-flash` |
| AI — Summarisation | Qwen Cloud `qwen3.7-plus` |
| AI — Rules engine | Qwen Cloud `qwen3.7-max` |
| AI — Embeddings | Qwen Cloud `text-embedding-v4` (1024-dim) |
| UI | Tailwind CSS 4, shadcn/ui, Lucide Icons |
| Hosting (prod) | Alibaba Cloud Function Compute 3.0 (Docker container) |

---

## Resetting the local database

If you need to wipe and re-apply the schema (e.g. after schema changes):

```bash
docker compose down -v   # removes the volume — all data is lost
docker compose up -d     # recreates with fresh schema
```

---

## Troubleshooting

**`AUTH_SECRET` missing on startup**
Run `npx auth secret` and set the result as `AUTH_SECRET` in `.env.local`.

**`/api/inbound` returns 401**
The `X-CF-Secret` header value doesn't match `CF_INBOUND_SECRET` in `.env.local`. Make sure both are identical and the dev server was restarted after changing `.env.local`.

**`/api/inbound` returns 404**
The `X-Recipient` header doesn't match any `forwarding_address` in the `users` table. Re-register or check the address shown in Settings.

**`expected 1024 dimensions` pgvector error**
The embedding column dimension mismatch. Reset the DB:
```bash
docker compose down -v && docker compose up -d
```

**`must contain the word 'json'` error from Qwen**
All `generateObject` prompts must include the word "JSON". This is already handled in `src/lib/ai/processor.ts`.


**Docker container not starting**
Ensure Docker Desktop is running, then:
```bash
docker compose down -v
docker compose up -d
```
