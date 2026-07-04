# EmailAgent — Job Opportunity Autopilot

**Hackathon Track 4: Autopilot Agent**

> Never let an important opportunity disappear inside a noisy inbox.

Job seekers apply through multiple platforms and receive assessments, interview
invitations, offers, and rejections in the same inbox as newsletters and
promotions. Traditional inboxes organize by sender and time. This agent
organizes by **goal**: what changed in your job search, what requires action,
and what deadline you cannot miss.

EmailAgent connects to any email provider via auto-forwarding — no OAuth, no
account access — and turns fragmented recruitment emails into a structured,
actionable opportunity board backed by Qwen AI and Alibaba Cloud.

---

## How it works

1. Register → get a unique high-entropy forwarding address (e.g. `abc1234567890@emailagent.top`)
2. Add that address to Gmail/Outlook auto-forward settings
3. Cloudflare Email Routing delivers raw MIME to a Function Compute inbound endpoint
4. The email is persisted immediately; a job queue processes it with Qwen
5. Qwen extracts structured event data; deterministic code validates, matches,
   and gates the result by composite confidence
6. The Opportunity Board updates automatically — high-confidence events apply
   immediately; mid-confidence events wait for your confirmation
7. You approve or reject proposed calendar events, reply drafts, and stage updates

---

## Core Capabilities

- **Opportunity Board** — five-stage kanban (Applied → Assessment → Interview → Offer → Closed)
- **Event timeline** — immutable, event-sourced; stage is a projection of confirmed events
- **Composite confidence gate** — automatic (≥0.85) / pending (0.60–0.84) / human review (<0.60)
- **Human-in-the-loop** — proposed actions require approval; no automatic external sends
- **Durable job queue** — FOR UPDATE SKIP LOCKED, 5-min lease, exponential retry
- **Idempotent pipeline** — SHA-256 content hash prevents duplicate AI calls
- **Valuable deals** — surfaces only offers matching explicit user preferences
- **Demo replay** — fixture-based endpoint reproduces the full pipeline without a live email provider
- **Prompt-injection resistance** — email content validated by Zod schema, not prompt engineering alone

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.9+ |
| pnpm | 11+ (`npm install -g pnpm`) |
| Docker Desktop | any (local PostgreSQL) |
| Git | any |

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

Fill in `.env.local`:

```env
# Auth.js v5
AUTH_SECRET=          # npx auth secret

# PostgreSQL (Docker locally) or PolarDB connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_agent

# Qwen Cloud
QWEN_API_KEY=         # sk-... from home.qwencloud.com
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Email forwarding
INBOUND_DOMAIN=emailagent.top
CF_INBOUND_SECRET=    # any strong random string

# Job runner and demo replay
JOB_RUNNER_SECRET=
DEMO_REPLAY_SECRET=

# Web Push (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start the database

```bash
docker compose up -d
```

Apply the opportunity autopilot migration:

```bash
docker exec -i email-agent-postgres psql -U postgres -d email_agent \
  < scripts/db/2026-07-04-opportunity-autopilot.sql
```

### 4. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Register at `/register`
2. Complete preference onboarding at `/onboarding`
3. Your forwarding address is shown in Settings

---

## Automated Tests

```bash
pnpm test               # all tests (no Qwen key required)
pnpm test:domain        # domain unit tests only
pnpm lint               # ESLint
pnpm exec tsc --noEmit  # TypeScript
pnpm build              # production build
```

All five commands must exit 0.

---

## Demo Replay (No Email Provider Required)

Inject a named fixture through the same inbound pipeline:

```bash
# available fixtures: application | assessment | interview | rejection | prompt-injection
curl -X POST http://localhost:3000/api/demo/replay \
  -H "Authorization: Bearer <DEMO_REPLAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"fixture":"interview"}'

# trigger job processing
curl -X POST http://localhost:3000/api/jobs/process-email \
  -H "Authorization: Bearer <JOB_RUNNER_SECRET>"
```

Navigate to `/opportunities` to see the result.

---

## Live Qwen Evaluation (Optional)

Requires a valid `QWEN_API_KEY`. Uses real API quota.

```bash
RUN_LIVE_QWEN_EVAL=1 pnpm eval:agent
```

---

## Deployed Demo

See [`docs/alibaba-cloud-proof.md`](docs/alibaba-cloud-proof.md) for the live
Function Compute URL, ACR image tag, and deployment evidence.

Health check:

```bash
curl https://<FC-URL>/api/health
# {"status":"ok","service":"emailagent","timestamp":"..."}
```

---

## Documentation

| Document | Description |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Mermaid pipeline diagram, trust model, component descriptions |
| [`docs/testing-instructions.md`](docs/testing-instructions.md) | Full testing guide including deployed environment |
| [`docs/demo-script.md`](docs/demo-script.md) | Three-minute demo timing and fallback notes |
| [`docs/submission-description.md`](docs/submission-description.md) | Track 4 qualification, technical highlights, stack |
| [`docs/alibaba-cloud-proof.md`](docs/alibaba-cloud-proof.md) | Alibaba Cloud deployment proof |

---

## Project Structure

```
cloudflare/
├── email-worker.ts              # Cloudflare Email Worker
└── wrangler.toml

scripts/
└── db/
    ├── schema.sql               # Baseline schema
    └── 2026-07-04-opportunity-autopilot.sql  # Opportunity tables migration

src/
├── app/
│   ├── onboarding/             # Preference setup (first-run)
│   ├── opportunities/          # Opportunity Board
│   ├── deals/                  # Valuable Deals page
│   ├── inbox/                  # All Emails (secondary view)
│   ├── settings/               # Forwarding address + preferences
│   └── api/
│       ├── inbound/            # POST: receive raw MIME (persist-first, 202)
│       ├── jobs/
│       │   ├── process-email/  # POST: job runner (Bearer auth)
│       │   └── send-digest/    # POST: daily summary runner (Bearer auth)
│       ├── demo/replay/        # POST: fixture replay (Bearer auth)
│       ├── ics/action/[id]/    # GET: ICS calendar download (authenticated)
│       ├── notifications/      # VAPID public key + push subscription
│       └── health/             # GET: no-DB health check
├── components/
│   ├── opportunities/          # OpportunityBoard, OpportunityCard, AttentionPanel
│   └── deals/                  # DealList
├── lib/
│   ├── agent/
│   │   ├── extract.ts          # Qwen structured extraction boundary
│   │   ├── orchestrator.ts     # Confidence gating, tool execution
│   │   ├── tools.ts            # 8-tool allowlist + Zod validation
│   │   └── deals.ts            # Deal relevance gating
│   ├── opportunities/
│   │   ├── schemas.ts          # Zod domain contracts
│   │   ├── normalize.ts        # Deterministic company/role normalization
│   │   ├── match.ts            # Opportunity scoring
│   │   ├── project.ts          # Timeline projection → stage
│   │   ├── repository.ts       # DB access layer (all accept PoolClient)
│   │   └── board-query.ts      # Board read model
│   ├── jobs/
│   │   └── email-jobs.ts       # Queue: enqueue, claim, complete, fail
│   ├── actions/
│   │   ├── preferences-actions.ts  # Preference upsert server action
│   │   └── opportunity-actions.ts  # Approve/reject agent actions
│   ├── notifications/
│   │   └── digest.ts           # Daily digest builder
│   └── db/
│       └── transaction.ts      # withTransaction<T> helper
└── tests/
    ├── opportunities/           # Schema, normalization, matching, board
    ├── agent/                   # Extraction, orchestration, deals, actions
    ├── jobs/                    # Queue, lease, retry, idempotency
    ├── api/                     # End-to-end pipeline contract
    └── fixtures/emails/         # Anonymized MIME fixtures
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.9 App Router, React 19.2.4, TypeScript 5 |
| AI | Qwen Cloud (qwen-plus) via AI SDK 7 `generateObject` |
| Auth | Auth.js v5 — Credentials provider, JWT sessions |
| Database | PostgreSQL 16 + pgvector (Docker) / Alibaba Cloud PolarDB (production) |
| Email ingestion | Cloudflare Email Routing → Email Worker → Function Compute |
| Job queue | PolarDB-backed, FOR UPDATE SKIP LOCKED, exponential retry |
| Hosting | Alibaba Cloud Function Compute 3.0 (custom AMD64 container) |
| Container registry | Alibaba Cloud ACR Personal Edition |
| Notifications | Web Push (VAPID), ICS calendar, mailto drafts |
| UI | MUI 9 (Material UI), Server Components + Server Actions |

---

## Resetting the Local Database

```bash
docker compose down -v   # removes volume — all data lost
docker compose up -d     # recreates with fresh schema
# re-apply migration after restart:
docker exec -i email-agent-postgres psql -U postgres -d email_agent \
  < scripts/db/2026-07-04-opportunity-autopilot.sql
```

---

## Security Notes

- Secrets are never committed to Git.
- Email content is placed only in the Qwen user prompt under the `UNTRUSTED_EMAIL`
  label — it cannot define tools or change permissions.
- Tool allowlist is enforced by Zod schema validation, not prompt engineering.
- All DB mutations check user ownership; actions are locked with `FOR UPDATE`.
- The demo replay endpoint accepts only a named fixture enum, never raw email content.

---

## License

MIT
