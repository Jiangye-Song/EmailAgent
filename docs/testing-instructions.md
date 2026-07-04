# Testing Instructions

**EmailAgent — Job Opportunity Autopilot**
**Track 4: Autopilot Agent**

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20.9+ |
| pnpm | 11+ (`npm install -g pnpm`) |
| Docker Desktop | any (local DB) |
| Git | any |

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd EmailAgent
pnpm install
```

---

## 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
# Auth.js v5
AUTH_SECRET=          # npx auth secret

# PostgreSQL (Docker local) or PolarDB connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_agent

# Qwen Cloud
QWEN_API_KEY=         # sk-... from home.qwencloud.com
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Cloudflare inbound secret (any strong random string)
INBOUND_DOMAIN=emailagent.top
CF_INBOUND_SECRET=

# Job runner and replay secrets
JOB_RUNNER_SECRET=
DEMO_REPLAY_SECRET=

# Web Push (optional — leave blank to disable)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Start Database

```bash
docker compose up -d
```

Apply the opportunity autopilot migration:

```bash
docker exec -i email-agent-postgres psql -U postgres -d email_agent \
  < scripts/db/2026-07-04-opportunity-autopilot.sql
```

Verify new tables:

```bash
docker exec email-agent-postgres psql -U postgres -d email_agent -c "\dt"
```

Expected tables include: `opportunities`, `opportunity_events`, `agent_actions`,
`email_processing_jobs`, `user_preferences`, `valuable_deals`.

---

## 4. Automated Test Suite

Run all unit and integration tests (no Qwen key required):

```bash
pnpm test
```

Expected: **all tests pass** with zero failures.

Run domain-specific subsets:

```bash
pnpm test -- tests/opportunities   # schema, normalization, matching, projection, board
pnpm test -- tests/agent           # extraction, orchestration, deals, actions
pnpm test -- tests/jobs            # job queue, lease, retry, idempotency
pnpm test -- tests/api             # end-to-end pipeline contract
```

---

## 5. Type Check and Lint

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Both must exit 0 with zero errors.

---

## 6. Production Build

```bash
pnpm build
```

Must exit 0. Produces `.next/standalone` for container deployment.

---

## 7. Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

1. Register an account at `/register`.
2. Complete preference onboarding at `/onboarding`.
3. Your forwarding address is shown in Settings.

---

## 8. Local End-to-End Test (No Cloudflare Required)

### 8a. Inject a fixture via demo replay

```bash
curl -X POST http://localhost:3000/api/demo/replay \
  -H "Authorization: Bearer <DEMO_REPLAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"fixture":"interview"}'
```

Available fixtures: `application`, `assessment`, `interview`, `rejection`,
`prompt-injection`.

### 8b. Trigger job processing

```bash
curl -X POST http://localhost:3000/api/jobs/process-email \
  -H "Authorization: Bearer <JOB_RUNNER_SECRET>"
```

### 8c. View results

Navigate to `/opportunities`. The interview opportunity should appear on the board.

---

## 9. Live Qwen Extraction Evaluation (Optional)

Requires a valid `QWEN_API_KEY`. Uses real API quota.

```bash
RUN_LIVE_QWEN_EVAL=1 pnpm eval:agent
```

This loads the anonymized MIME fixtures, calls `extractEmailIntent`, and prints
expected versus actual event type. Exits non-zero on schema validation failure.

---

## 10. Deployed Demo (Alibaba Cloud)

See `docs/alibaba-cloud-proof.md` for the live Function Compute URL.

Health check:

```bash
curl https://<FC-URL>/api/health
# {"status":"ok","service":"emailagent","timestamp":"..."}
```

Demo replay against deployed environment:

```bash
curl -X POST https://<FC-URL>/api/demo/replay \
  -H "Authorization: Bearer <DEMO_REPLAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"fixture":"interview"}'
```

Trigger deployed job processing:

```bash
curl -X POST https://<FC-URL>/api/jobs/process-email \
  -H "Authorization: Bearer <JOB_RUNNER_SECRET>"
```

---

## 11. Security Checklist

- No credentials or real email content committed to Git.
- `AUTH_SECRET`, `CF_INBOUND_SECRET`, `JOB_RUNNER_SECRET`, `DEMO_REPLAY_SECRET`,
  `QWEN_API_KEY` must all be set via environment variables, never hardcoded.
- The demo replay endpoint accepts only an enum of named fixtures; it cannot
  inject arbitrary email content.
- Prompt injection: the `prompt-injection` fixture demonstrates that an email
  attempting to redefine tools or permissions still produces only allowlisted
  actions.

---

## 12. Full Quality Gate (Pre-submission)

```bash
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

All five commands must exit 0 before submission.
