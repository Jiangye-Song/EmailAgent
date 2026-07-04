# Job Opportunity Autopilot — Hackathon Design

**Date:** 2026-07-04
**Status:** Approved for implementation planning
**Hackathon track:** Track 4 — Autopilot Agent
**Working product name:** EmailAgent / Opportunity Autopilot

## 1. Product Thesis

Email overload is not primarily a reading problem. It is an opportunity-loss
problem.

Job seekers apply through many unrelated platforms and receive application
updates, assessments, interview invitations, document requests, offers, and
rejections in the same inbox as newsletters and promotions. Traditional inboxes
organize messages by sender and time, but users care about their current goals:

- What changed in my job search?
- What requires action today?
- Which deadline or interview could I miss?
- Which promotion is genuinely valuable to me?

EmailAgent is therefore not positioned as another AI email summarizer. It is a
goal-aware opportunity autopilot that turns fragmented email updates into a
personalized, actionable job-search board.

The core product promise is:

> Never let an important opportunity disappear inside a noisy inbox.

For each relevant message, the product answers:

1. What happened?
2. Why does it matter to this user?
3. When must the user act?
4. What should happen next?

## 2. Target User and Primary Scenario

### Primary user

A high-frequency job seeker applying through multiple job boards and company
career sites.

### Primary scenario

The user forwards email into EmailAgent. The agent recognizes job-search events,
associates messages with the correct company and role, updates an opportunity
timeline, identifies deadlines, proposes actions, and alerts the user when an
important event requires attention.

### Secondary proof of personalization

The product suppresses generic promotions but surfaces offers that meet the
user's explicit value preferences, such as:

- free membership gifts;
- discounts above a user-defined threshold;
- high-value coupons;
- offers from selected brands;
- valuable offers close to expiry.

This secondary scenario demonstrates that the underlying capability is
goal-aware value detection, not a hard-coded job-email classifier. It must not
compete with the job-search story in the main demo.

## 3. Hackathon Alignment

The project targets **Track 4: Autopilot Agent**.

It demonstrates:

- ambiguous real-world input through non-standard email content;
- Qwen-powered reasoning and structured extraction;
- tool selection and invocation;
- an end-to-end workflow that changes persistent application state;
- human-in-the-loop approval at consequential steps;
- error handling, replay, auditability, and deployment readiness.

The design is optimized for the published judging criteria:

| Criterion | Design response |
|---|---|
| Innovation & AI Creativity | Goal-aware opportunity tracking, cross-message entity association, dynamic action selection |
| Technical Depth & Engineering | Hybrid AI/deterministic orchestration, event timeline, validated tools, confidence gates, idempotency and retries |
| Problem Value & Impact | Authentic job-seeker pain with a clear cost of missed interviews and deadlines |
| Presentation & Documentation | A focused three-minute story, architecture diagram, public repository, English documentation |

## 4. Product Experience

### 4.1 First-run preference setup

The user completes a short guided questionnaire:

- target job titles;
- preferred locations and remote-work preference;
- companies of interest;
- events that require immediate alerts;
- promotion value thresholds;
- an optional free-form instruction.

The questionnaire uses explicit fields for predictable behavior and a free-form
instruction for flexibility. The system does not rely only on silently inferred
preferences.

### 4.2 Default home: Opportunity Board

After sign-in, the default page is a job opportunity board rather than the raw
inbox.

The board groups opportunities by current stage:

- Applied
- Assessment
- Interview
- Offer
- Closed

Each opportunity card shows:

- company and role;
- current stage and outcome;
- latest meaningful change;
- next recommended action;
- deadline or scheduled event;
- urgency;
- concise evidence explaining the agent's conclusion.

The event timeline is the source of truth. The stage shown on the card is a
projection of the latest confirmed, highest-priority event. This allows real
recruitment processes to skip stages without forcing an artificial linear
workflow.

### 4.3 Urgent attention area

The top of the board shows only events that require near-term attention:

- an interview is approaching;
- an assessment is due;
- an offer expires soon;
- the recruiter requested more information;
- an uncertain but potentially important event needs confirmation.

### 4.4 Secondary destinations

- **All Emails:** the existing inbox remains available as a secondary page.
- **Valuable Deals:** only promotions that satisfy explicit user value rules.
- **Preferences:** job targets, alert choices, deal thresholds, sender controls.

## 5. Core Agent Decision Model

The implementation uses a hybrid model:

> Qwen understands language; deterministic application code controls state;
> the user approves consequential actions.

### 5.1 Qwen responsibilities

Qwen receives the sanitized email content and relevant user preferences. It
returns a validated structured result containing:

- message domain: `job`, `deal`, or `other`;
- event type;
- company, role, location, and application reference when present;
- event time, deadline, and timezone evidence;
- recommended next action;
- evidence excerpts or field-level reasoning;
- model confidence;
- candidate tool calls.

Qwen does not directly write arbitrary database records or execute unrestricted
commands.

### 5.2 Deterministic responsibilities

Application code:

- validates all structured output;
- normalizes companies, roles, dates, links, and identifiers;
- checks for duplicate messages before model calls;
- associates the event with an existing opportunity;
- calculates a composite confidence score;
- applies confidence gates;
- validates state changes;
- validates and executes allowlisted tool calls;
- records an audit trail.

### 5.3 Confidence policy

The composite confidence combines model confidence with deterministic evidence,
including field completeness, exact application references, normalized
company/role matches, and explicit event language.

- **0.85–1.00:** safe board updates may be applied automatically.
- **0.60–0.84:** create a proposed update and request user confirmation.
- **Below 0.60:** retain the email and extraction for review without changing
  opportunity state or sending an urgent alert.

Consequential external actions always require user approval regardless of
confidence.

## 6. Opportunity Association and State

### 6.1 Association order

An incoming job event is linked using the strongest available signal:

1. exact application or requisition reference;
2. normalized company plus normalized role;
3. sender domain plus company and role;
4. constrained fuzzy match against active opportunities;
5. user confirmation when ambiguity remains.

The agent must not merge two plausible opportunities automatically when the
evidence is ambiguous.

### 6.2 Event types

The initial supported event types are:

- application received;
- recruiter contact;
- information requested;
- assessment assigned;
- assessment deadline changed;
- interview invited;
- interview scheduled or changed;
- offer received;
- rejection received;
- application withdrawn;
- general status update.

### 6.3 Timeline and projection

Every recognized event is appended to an immutable opportunity timeline. The
current card state is derived from confirmed events. Corrections create new
audit events rather than silently deleting history.

## 7. Agent Tools

Qwen may propose only the following tools:

| Tool | Purpose | Approval |
|---|---|---|
| `create_opportunity` | Create a company/role opportunity | Automatic only at high confidence |
| `append_opportunity_event` | Add a timeline event | Automatic only at high confidence |
| `propose_stage_update` | Change the board's current projection | Confirmation at medium confidence |
| `schedule_reminder` | Store an alert for a deadline or event | Automatic for safe local reminders |
| `prepare_calendar_event` | Generate an ICS calendar action | User clicks to execute |
| `prepare_reply` | Create a reply draft | User reviews; no automatic send |
| `save_valuable_deal` | Store a deal matching preferences | Automatic at high confidence |
| `request_human_review` | Ask the user to resolve ambiguity | Always safe |

Tool parameters are schema-validated. Email text cannot introduce new tools,
change permissions, or bypass approval.

## 8. End-to-End Data Flow

1. The user receives a unique, high-entropy forwarding address.
2. Cloudflare Email Routing sends the raw MIME message to the Email Worker.
3. The Worker forwards it to the Alibaba Cloud backend with a shared secret and
   the original recipient.
4. The backend validates the request, recipient, size, and sender policy.
5. The raw email and a lightweight PolarDB processing job are persisted before
   Qwen is called; the inbound request can then return `202 Accepted`.
6. A Function Compute timer invokes the authenticated job runner, which claims
   pending jobs without allowing two workers to process the same job.
7. Message identity is checked for idempotency before model invocation.
8. Qwen returns structured extraction and candidate tool calls.
9. The orchestrator validates the result, associates the opportunity, applies
   confidence gates, and executes safe tools.
10. The database stores the email, extraction, opportunity event, proposed
   actions, and audit trail.
11. Urgent events trigger push notification; ordinary changes enter the daily
    summary.
12. The Opportunity Board reads the current projection and timeline.
13. Approved user actions update the audit record and execute the prepared
    action.

## 9. Proposed Data Model

The existing `users`, `email_records`, `user_rules`, `sender_whitelist`, and
authentication tables remain.

### `user_preferences`

- `user_id`
- `target_roles`
- `locations`
- `remote_preference`
- `target_companies`
- `immediate_alert_events`
- `deal_preferences`
- `freeform_instruction`
- timestamps

### `opportunities`

- `id`, `user_id`
- normalized company, role, and location
- external/application reference
- current stage and outcome
- latest confidence
- next action and next deadline
- timestamps

### `opportunity_events`

- `id`, `opportunity_id`, `email_record_id`
- event type
- event time and deadline
- structured evidence
- confidence
- confirmation status
- timestamps

### `agent_actions`

- `id`, `user_id`, `opportunity_event_id`
- allowlisted action type
- validated payload
- status: proposed, approved, rejected, executed, or failed
- execution result and error
- timestamps

### Additions to `email_records`

- processing status: received, processing, completed, failed
- processing attempt count
- last processing error
- message domain and structured extraction
- content hash or stable message identity

### `email_processing_jobs`

- `id`, `email_record_id`, `user_id`
- status: pending, processing, completed, or failed
- attempt count and next-attempt time
- lease owner and lease expiry to prevent concurrent processing
- last error
- timestamps

### `valuable_deals`

- `id`, `user_id`, `email_record_id`
- brand and offer type
- extracted value and expiry
- matched user rule
- relevance reason
- timestamps

## 10. Alerts and Summaries

Immediate alerts are limited to user-selected high-value events, including
interviews, assessments, offers, explicit document requests, and deadlines.

Lower-priority job changes are grouped into a daily summary. Generic promotions
do not generate alerts. A deal creates an alert only when it meets the user's
explicit rule and is urgent enough to justify interruption.

Every alert links to the relevant opportunity or deal and explains why it was
sent.

## 11. Reliability, Security, and Safety

### Persist before processing

Raw input is stored before model invocation, so temporary Qwen failures cannot
lose the email.

### Idempotency

Message ID plus recipient and a content hash prevent repeated AI calls, duplicate
events, and duplicate alerts.

### Retries and failure state

The Function Compute timer runs the lightweight PolarDB-backed job runner.
Transient failures retry up to three times with increasing delay. An expired
processing lease makes an interrupted job eligible for retry. Permanent failures
remain visible as `failed` processing records and can be replayed by an
authenticated development/admin command.

### Prompt-injection resistance

Email content is untrusted data. It is separated from system instructions,
parsed into constrained schemas, and cannot define tools or permissions.
Destructive and external actions require human approval.

### Input controls

- shared-secret validation between Cloudflare and the backend;
- high-entropy forwarding aliases;
- MIME size and attachment limits;
- sender policy as a filtering control, not as proof of identity;
- URL protocol allowlist;
- ownership checks on every user-visible mutation.

### Auditability

The system records the source message, extracted evidence, confidence, proposed
tool call, user decision, execution result, and error. Judges can see how the
agent reached an outcome rather than trusting an unexplained label.

## 12. Deployment Architecture

- **Cloudflare Email Routing and Email Worker:** inbound email transport.
- **Alibaba Cloud ACR:** stores the AMD64 application container.
- **Alibaba Cloud Function Compute:** runs the Next.js frontend, API, agent
  orchestrator, and authenticated actions.
- **Alibaba Cloud PolarDB for PostgreSQL:** application state, pgvector data,
  opportunity timelines, and audit records.
- **Qwen Cloud:** language understanding, structured extraction, and action
  planning.
- **Web Push and ICS:** immediate alerts and user-approved calendar actions.

The backend must be publicly testable through a documented test account or
fixture workflow throughout the judging period.

## 13. Demo Safety and Replay

The primary demonstration uses a real forwarded email.

A committed fixture-based replay command is the fallback. It:

- uses a realistic raw MIME fixture;
- calls the same authenticated inbound endpoint;
- passes through the same Qwen, validation, database, and UI path;
- uses a unique message ID per intentional replay;
- is documented as a resilience mechanism, not presented as live email.

No pre-rendered or manually inserted board state is used to simulate agent
behavior.

## 14. Testing and Evaluation

### Fixture set

Create anonymized MIME fixtures for:

1. application acknowledgement;
2. assessment with deadline;
3. interview invitation;
4. interview reschedule;
5. offer with expiry;
6. rejection;
7. ambiguous recruiter outreach;
8. ordinary promotion;
9. high-value member gift;
10. duplicate delivery;
11. prompt-injection attempt.

### Automated checks

- structured extraction schema validation;
- normalization and opportunity association;
- legal state projection;
- confidence gating;
- tool allowlist and approval enforcement;
- message and action idempotency;
- authenticated ownership checks;
- replay behavior;
- production build and lint.

### Demonstrable success targets

- all fixtures produce schema-valid output;
- duplicate fixtures create one event and one alert;
- no fixture can invoke an unregistered or unapproved action;
- every automatic board update includes source evidence;
- ambiguous fixtures enter human review;
- the end-to-end fixture path is repeatable on the deployed environment.

## 15. Three-Minute Demo Story

- **0:00–0:25:** authentic pain — job opportunities are buried among unrelated
  email.
- **0:25–0:45:** set target role, location, alert events, and deal threshold.
- **0:45–1:15:** forward a realistic recruitment email.
- **1:15–1:45:** show Qwen extraction, opportunity association, timeline update,
  confidence, and evidence.
- **1:45–2:15:** approve a calendar/reminder or reply-draft action.
- **2:15–2:35:** show generic promotion suppression and one valuable offer.
- **2:35–2:55:** explain the tool-using agent and Alibaba Cloud architecture.
- **2:55–3:00:** close with the product promise.

## 16. Required Hackathon Deliverables

- public source repository;
- visible open-source license;
- English project description and testing instructions;
- proof that the backend runs on Alibaba Cloud;
- architecture diagram;
- publicly viewable demonstration video under three minutes;
- working demo or test account available through the judging period;
- Track 4 identified in the submission;
- optional public build-journey post for the blog prize.

## 17. Scope Boundaries

### Required for this submission

- preference onboarding;
- Opportunity Board and timeline;
- structured job event extraction;
- opportunity association;
- confidence and evidence;
- urgent reminders;
- validated tools and human approval;
- persisted processing status, idempotency, retry, and replay;
- one valuable-deal demonstration;
- Alibaba Cloud deployment and submission materials.

### Explicitly deferred

- automatic email sending;
- full Gmail or Outlook account synchronization;
- team inboxes, CRM, and Slack;
- broad semantic-search UI;
- large-scale distributed queue infrastructure;
- a comprehensive shopping or coupon product;
- autonomous destructive actions.

The existing Inbox remains as a secondary view. Unrelated refactoring is out of
scope.

## 18. Rejected Alternatives

### Generic AI inbox

Rejected because summarization, classification, drafting, and search are already
common product capabilities and do not create a memorable hackathon thesis.

### Pure autonomous LLM agent

Rejected because unconstrained state changes are inconsistent, difficult to
audit, and poorly aligned with production-readiness and human-in-the-loop
requirements.

### Keyword-only job tracker

Rejected because recruitment messages vary significantly across platforms and
the approach would not demonstrate sophisticated use of Qwen.

### Infrastructure-first redesign

Rejected for the submission window. The design adds durable status, retries, and
replay without introducing a large distributed queue system before the core
product story is complete.
