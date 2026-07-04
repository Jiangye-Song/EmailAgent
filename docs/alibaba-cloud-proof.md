# Alibaba Cloud Deployment Proof

## Status

Pending deployment — local container build verified.

## Target Architecture

- **Region:** cn-hangzhou (or as selected)
- **Container Registry:** Alibaba Cloud ACR Personal Edition
- **Runtime:** Alibaba Cloud Function Compute (custom container web function)
- **Database:** PolarDB PostgreSQL compatible

## Image Build

```bash
docker build --platform linux/amd64 -t email-agent:demo .
```

## Environment Variables Required

See `.env.local.example` for required variables:
- `DATABASE_URL` — PolarDB connection string
- `NEXTAUTH_SECRET` — Auth.js secret
- `NEXTAUTH_URL` — Public deployment URL
- `QWEN_API_KEY` — Qwen Cloud API key
- `CF_INBOUND_SECRET` — Shared secret with Cloudflare Email Worker
- `JOB_RUNNER_SECRET` — Job runner Bearer token
- `DEMO_REPLAY_SECRET` — Demo replay Bearer token
- `VAPID_*` — Optional web push configuration

## Database Migration

Run against PolarDB after provisioning:

```bash
psql $DATABASE_URL -f scripts/db/schema.sql
psql $DATABASE_URL -f scripts/db/2026-07-04-opportunity-autopilot.sql
```

## Deployment Steps (to be completed)

- [ ] Create ACR Personal Edition namespace and repository
- [ ] Push AMD64 image: `docker push <acr-registry>/emailagent/email-agent:demo`
- [ ] Create PolarDB PostgreSQL in same VPC
- [ ] Run migrations
- [ ] Create Function Compute custom-container web function
- [ ] Configure environment variables as runtime secrets
- [ ] Set up 1-minute FC timer → POST /api/jobs/process-email
- [ ] Set up daily FC timer → POST /api/jobs/send-digest

## Verification (to be completed after deployment)

- [ ] Public URL returns 200 at /api/health
- [ ] /login page loads
- [ ] Demo replay endpoint responds correctly
- [ ] Inbound email processing works end-to-end
