# Submission Description

**Project name:** EmailAgent — Job Opportunity Autopilot
**Hackathon track:** Track 4 — Autopilot Agent
**Primary language:** English

---

## What it does

EmailAgent is a goal-aware email autopilot for job seekers. It connects to any
email provider via auto-forwarding — no OAuth, no account access — and turns
fragmented recruitment emails into a structured, actionable job-search board.

When an email arrives, the agent:

1. **Persists** the raw MIME email immediately, before any AI is called.
2. **Extracts** structured information with Qwen: event type, company, role,
   deadline, evidence, and candidate actions.
3. **Associates** the email with an existing opportunity using a three-tier
   signal chain (exact reference → normalized company+role → token overlap).
4. **Gates** decisions by composite confidence: automatic updates at ≥0.85,
   human confirmation at 0.60–0.84, human review below 0.60.
5. **Updates** an immutable opportunity timeline — the board stage is always a
   projection of confirmed events, never a mutable label.
6. **Proposes** calendar events, reply drafts, and stage updates for user approval.
7. **Alerts** users to interviews, offers, and deadlines via push notification or
   daily digest.

The same pipeline filters promotional emails against explicit user preferences.
Generic discounts are suppressed; free gifts, high-discount offers, and
target-brand deals are surfaced separately.

---

## Why it qualifies for Track 4: Autopilot Agent

The project demonstrates all Track 4 criteria:

| Criterion | Implementation |
|---|---|
| Ambiguous real-world input | Recruitment emails vary widely; no two platforms format them the same way |
| Qwen-powered reasoning | Structured extraction with `generateObject` + `JobEmailExtractionSchema` |
| Tool selection and invocation | 8-tool allowlist validated by Zod; Qwen proposes, code controls |
| Persistent state changes | Opportunity timeline, agent actions, processing status in PolarDB |
| Human-in-the-loop approval | Proposed actions require user confirmation before execution |
| Error handling and reliability | Job queue with lease, exponential retry, idempotent deduplication |
| Auditability | Source email, extraction, confidence, tool call, and user decision all recorded |
| Deployed and testable | Alibaba Cloud Function Compute + PolarDB, public replay endpoint |

---

## Technical highlights

**Hybrid AI/deterministic design.** Qwen understands language; deterministic
application code controls state. Email content cannot define tools, escalate
permissions, or trigger automatic external actions. This is enforced by Zod
schema validation at every boundary, not prompt engineering alone.

**Persist-before-process pattern.** Raw email is stored before Qwen is called.
Transient model failures cannot lose email. The job queue retries automatically.

**Composite confidence formula:**
`composite = model × 0.50 + evidence × 0.15 + identity × 0.25 + event × 0.10`

This combines Qwen's model confidence with deterministic signals (field
completeness, exact reference matches, explicit event language) so the gate is
resistant to confident-but-wrong extractions.

**Event-sourced opportunity timeline.** Every recognized event is appended
immutably. Current stage is derived by projecting the confirmed event sequence.
Real recruitment processes can skip stages; corrections create audit events
rather than overwriting history.

**Distributed job safety.** `FOR UPDATE SKIP LOCKED` prevents two workers from
processing the same job. A 5-minute lease makes stuck jobs reclaimable. Content
hash deduplication prevents duplicate AI calls when Cloudflare delivers the same
email twice.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.9 App Router, React 19, TypeScript 5 |
| AI | Qwen Cloud (qwen-plus) via AI SDK 7 `generateObject` |
| Auth | Auth.js v5 — Credentials provider, JWT sessions |
| Database | Alibaba Cloud PolarDB for PostgreSQL + pgvector |
| Email ingestion | Cloudflare Email Routing → Email Worker → Function Compute |
| Job queue | PolarDB-backed, FOR UPDATE SKIP LOCKED, exponential retry |
| Hosting | Alibaba Cloud Function Compute 3.0 (custom container, AMD64) |
| Container | Alibaba Cloud ACR Personal Edition |
| Notifications | Web Push (VAPID), ICS calendar, mailto drafts |
| UI | MUI 9 (Material UI), Server Components + Server Actions |

---

## Significant changes made during the hackathon

The project started as a basic AI email summarizer. During the hackathon the
following systems were designed and built from scratch:

- Opportunity domain model: schema, normalization, matching, projection
- Qwen structured extraction with prompt-injection resistance
- Composite confidence gating (three tiers, formula-based)
- Transactional job queue with lease-based distributed safety
- Persist-before-process inbound pipeline
- Event-sourced opportunity timeline
- HITL action state machine (proposed → approved → executed / rejected)
- ICS calendar generation and mailto reply drafts
- Daily digest with idempotent sending
- Valuable deals gating against user preferences
- Alibaba Cloud standalone container deployment
- Demo replay endpoint with fixture-based scenarios
- Full test suite (Vitest, no live API keys required for CI)

---

## Test account

See `docs/testing-instructions.md` for setup steps and the demo replay commands
that reproduce the full pipeline without a live email provider.

The deployed Function Compute endpoint is documented in
`docs/alibaba-cloud-proof.md`.

---

## License

MIT — see `LICENSE` in the repository root.

---

## Repository

Public source repository with open-source license, English documentation,
architecture diagram, and testing instructions as required by the submission
guidelines.
