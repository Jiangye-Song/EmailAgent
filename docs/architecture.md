# EmailAgent — Job Opportunity Autopilot: Architecture

**Track 4: Autopilot Agent**

## End-to-End Pipeline

```mermaid
flowchart TD
    A[User's Email Provider\nGmail / Outlook] -->|auto-forward| B[Cloudflare Email Routing]
    B -->|raw MIME via Worker| C[POST /api/inbound\nFunction Compute]

    subgraph TRUST_BOUNDARY["Trust Boundary: Untrusted Input"]
        C -->|shared-secret validation\n10 MB limit, MIME parse| D[enqueueInboundEmail\nSHA-256 dedup]
    end

    D -->|persist email_records\n+ email_processing_jobs| E[(PolarDB PostgreSQL)]
    C -->|202 Accepted| A

    F[FC Timer — 1 min] -->|Bearer auth| G[POST /api/jobs/process-email]
    G -->|FOR UPDATE SKIP LOCKED\nclaim ≤3 jobs| E
    G -->|processStoredEmail| H[Orchestrator]

    subgraph AGENT["Agent Layer"]
        H -->|email text + preferences| I[Qwen extraction\ngenerateObject + schema]
        I -->|JobEmailExtraction| J[Deterministic validation\nnormalize · match · confidence]
        J -->|composite score ≥ 0.85| K[Auto: create/update opportunity\nappend timeline event]
        J -->|score 0.60–0.84| L[Propose: stage update\nrequest confirmation]
        J -->|score < 0.60| M[request_human_review\nno state change]
    end

    K -->|withTransaction| E
    L -->|withTransaction| E
    M -->|withTransaction| E

    E -->|opportunity board query| N[/opportunities\nOpportunity Board]
    E -->|agent_actions pending| O[AttentionPanel\nHITL queue]

    O -->|user approves| P{Action type}
    P -->|prepare_calendar_event| Q[GET /api/ics/action/:id\nICS download]
    P -->|prepare_reply| R[mailto: link\nuser reviews draft]
    P -->|propose_stage_update| S[Stage confirmed\nopportunity updated]

    FC2[FC Timer — daily] -->|Bearer auth| T[POST /api/jobs/send-digest]
    T -->|non-urgent events\nnot yet sent| E
    T -->|Web Push| U[Browser notification]

    style TRUST_BOUNDARY fill:#fff3cd,stroke:#ffc107
    style AGENT fill:#d1ecf1,stroke:#0c7cd5
```

## Component Descriptions

### Cloudflare Email Worker (`cloudflare/email-worker.ts`)

Receives raw MIME email from Cloudflare Email Routing and forwards it to the
Function Compute inbound endpoint with a shared secret and the original
recipient address. Stateless — no email content is stored in Cloudflare.

### Inbound Route (`/api/inbound`)

First trust boundary. Validates the shared secret with constant-time comparison,
enforces a 10 MB size limit, parses MIME, resolves the recipient to a user ID,
computes a SHA-256 content hash for idempotency, and persists the raw email plus
a processing job in one transaction. Returns `202 Accepted` without calling Qwen.

### Email Processing Jobs (`src/lib/jobs/email-jobs.ts`)

Lightweight PolarDB-backed job queue with:
- **Content-hash deduplication** — same email delivered twice creates one job.
- **FOR UPDATE SKIP LOCKED** — prevents two workers from claiming the same job.
- **5-minute lease** — a crashed worker's job becomes reclaimable after expiry.
- **Exponential retry** — failed jobs retry at 1, 5, and 15 minutes; permanently
  failed after 4 attempts.

### Qwen Extraction (`src/lib/agent/extract.ts`)

Calls `generateObject` with a constrained `JobEmailExtractionSchema`. Email
content is placed in the user prompt under the `UNTRUSTED_EMAIL` label,
separated from the system prompt. The system prompt states that email
instructions cannot define tools or change permissions.

### Deterministic Orchestrator (`src/lib/agent/orchestrator.ts`)

Controls all state transitions. Qwen understands language; application code
controls state:

1. **Normalize** company and role to a canonical form.
2. **Match** against existing opportunities using three signals (exact reference,
   normalized company+role, token overlap).
3. **Composite confidence** = `model × 0.50 + evidence × 0.15 + identity × 0.25 + event × 0.10`.
4. **Gate** by threshold — automatic (≥0.85), pending (0.60–0.84), review (<0.60).
5. **Validate tool calls** against the 8-tool allowlist using Zod schemas.
6. **Execute** safe tools in a short transaction; persist external proposals as
   `status = 'proposed'`.

### Confidence Gates

| Score | Action |
|---|---|
| ≥ 0.85 | Automatic: create/update opportunity, append timeline event |
| 0.60–0.84 | Proposed: `propose_stage_update` waits for user confirmation |
| < 0.60 | `request_human_review` only — no opportunity state change |

External actions (`prepare_reply`, `prepare_calendar_event`) always require user
approval regardless of confidence.

### Opportunity Timeline

Events are immutable. Current stage is derived by projecting the confirmed
event sequence onto a priority map. Corrections create new audit events rather
than overwriting history. This lets real recruitment processes skip stages
without breaking the board.

### Human Approval (`src/lib/actions/opportunity-actions.ts`)

State machine: `proposed → approved → executed` or `proposed → rejected`.
All transitions check user ownership with `FOR UPDATE`. Calendar events return
an ICS download URL; reply drafts return a `mailto:` link. Neither executes
without user action.

### Idempotency Controls

| Layer | Mechanism |
|---|---|
| Email ingestion | SHA-256 of `userId + messageId + rawBuffer` |
| Opportunity events | `ON CONFLICT (opportunity_id, event_type, email_record_id) DO UPDATE` |
| Digest sending | `digest_sent_at` timestamp prevents resending |
| Job claiming | FOR UPDATE SKIP LOCKED prevents double processing |

## Trust Model

```
UNTRUSTED: email body, sender address, subject, attachment content
TRUSTED: shared CF_INBOUND_SECRET, Auth.js session, DB row ownership checks
CONSTRAINED: Qwen output validated by Zod schema before any state change
HUMAN-GATED: prepare_reply, prepare_calendar_event, propose_stage_update
```

Email content cannot define new tools, escalate permissions, or trigger
automatic external actions. This design is enforced by schema validation, not
prompt engineering alone.

## Deployment Architecture

```
Cloudflare Edge
  └── Email Routing → Email Worker (email-worker.ts)

Alibaba Cloud — cn-hangzhou
  ├── ACR Personal Edition
  │     └── emailagent/email-agent:demo (AMD64, node:22-bookworm-slim)
  ├── Function Compute 3.0
  │     ├── Web function — serves Next.js 16 App Router (standalone output)
  │     ├── 1-minute timer → POST /api/jobs/process-email (Bearer)
  │     └── Daily timer → POST /api/jobs/send-digest (Bearer)
  └── PolarDB for PostgreSQL (pgvector extension)
        ├── schema.sql (baseline)
        └── 2026-07-04-opportunity-autopilot.sql (opportunity tables)

Qwen Cloud (DashScope)
  └── qwen-plus (structured extraction via AI SDK 7 generateObject)
```

## Data Flow Summary

1. Email provider auto-forwards to Cloudflare Email Routing.
2. Email Worker validates secret and POSTs raw MIME to Function Compute.
3. `/api/inbound` deduplicates, persists, and returns `202` — no Qwen call.
4. FC 1-minute timer triggers job runner; worker claims job with lease.
5. Orchestrator extracts outside transaction (Qwen), writes inside short transaction.
6. Opportunity board reads projected state from PolarDB.
7. User reviews proposed actions in AttentionPanel; approves or rejects.
8. Approved calendar/reply action executes via ICS download or mailto link.
9. Daily FC timer sends digest push notification for non-urgent events.
