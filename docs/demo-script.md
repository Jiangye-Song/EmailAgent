# Three-Minute Demo Script

**Track 4: Autopilot Agent — EmailAgent / Job Opportunity Autopilot**

Target length: **2:50** (leaves 10 s editing margin before 3:00 limit).

---

## 0:00–0:25 — The Pain

> "I'm a job seeker. I've applied to fifteen companies across LinkedIn, job boards,
> and company portals. Every update — assessments, interview invitations, offers,
> rejections — lands in the same inbox as newsletters and promotions.
>
> Important opportunities disappear. I miss deadlines I didn't even know existed.
> Traditional inboxes organize by sender and time. I care about one thing: what
> changed in my job search and what requires action today."

**Show:** a typical cluttered inbox with promotional emails buried next to a
critical interview invitation.

---

## 0:25–0:45 — Set Preferences (Onboarding)

> "The first thing I do is tell the agent what I care about."

**Click:** `/onboarding`

**Fill in:**
- Target roles: `Software Engineer`, `Backend Developer`
- Locations: `Sydney`, `Remote`
- Remote preference: `Hybrid`
- Immediate alert events: `interview_invited`, `offer_received`
- Minimum discount for deals: `40%`
- Free gifts: enabled

> "The agent will now prioritize these goals when it reads my emails. It won't
> interrupt me for a 10% off coupon — only for things that actually matter."

**Click:** Save Preferences → redirects to Opportunity Board.

---

## 0:45–1:15 — Forward a Real Email

> "I've set Gmail to auto-forward to my unique address. Let me show what happens
> when an interview invitation arrives."

**Option A (live):** Forward a real interview invitation email in Gmail.

**Option B (demo replay):**

```bash
curl -X POST https://<FC-URL>/api/demo/replay \
  -H "Authorization: Bearer <DEMO_REPLAY_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"fixture":"interview"}'
```

> "The agent has received the email. Notice: it returned 202 immediately — the
> email is stored; Qwen hasn't run yet. The job queue does that."

**Trigger job processing** (or wait for FC timer):

```bash
curl -X POST https://<FC-URL>/api/jobs/process-email \
  -H "Authorization: Bearer <JOB_RUNNER_SECRET>"
```

> "Now Qwen reads the email inside a constrained schema. It cannot define new
> tools or bypass approvals — those are enforced by code, not prompt engineering."

---

## 1:15–1:45 — Board and Evidence

**Navigate to:** `/opportunities`

> "The opportunity board updates automatically. I can see Acme Corp has moved
> to 'Interview' stage."

**Click on the card.**

> "Here is the evidence: the exact quote from the email that justified this
> decision, the model's confidence score, and the composite confidence we
> computed — model weight plus field completeness, exact company match, and
> explicit interview language."

**Show AttentionPanel (top of board):**

> "This panel surfaces what needs attention now. The interview has a deadline,
> so it appears here automatically."

---

## 1:45–2:15 — Approve an Action

**In AttentionPanel, show a proposed calendar event:**

> "Qwen proposed adding this interview to my calendar. It's in 'proposed' state —
> the agent cannot act without my approval."

**Click:** Approve

> "Now I can download the ICS file and add it to any calendar with one click.
> If I had rejected it, the record would still be in the audit trail."

**Optionally show a proposed reply draft:**

> "For reply drafts, the agent prepares a mailto link. I review it, edit it,
> and send it from my own email client. The agent never sends automatically."

---

## 2:15–2:35 — Valuable Deal (Secondary Proof)

**Navigate to:** `/deals`

> "The same pipeline also reads promotional emails. Most are suppressed — a 10%
> discount doesn't meet my 40% threshold. But this one—"

**Show a deal card:**

> "—Alibaba Cloud offered a free $300 credit for new accounts. That matches my
> 'free gifts' preference. The agent stored it with the matched rule and expiry,
> so I don't miss it."

> "This shows the underlying capability is goal-aware value detection, not a
> hard-coded job classifier."

---

## 2:35–2:55 — Architecture

**Show:** `docs/architecture.md` or the architecture diagram.

> "The pipeline runs entirely on Alibaba Cloud. Cloudflare routes inbound email
> to an Email Worker, which forwards raw MIME to Function Compute. The email is
> persisted first — if Qwen fails, nothing is lost. A 1-minute Function Compute
> timer claims and processes jobs. PolarDB stores the opportunity timeline, agent
> actions, and audit records. Qwen provides structured extraction via AI SDK 7's
> `generateObject` — validated output, not free-form text."

---

## 2:55–3:00 — Promise

> "EmailAgent is a goal-aware opportunity autopilot. It turns fragmented email
> updates into a personalized, actionable job-search board.
>
> Never let an important opportunity disappear inside a noisy inbox."

---

## Fallback Notes

- If live email is delayed, use the replay endpoint. It takes the same code path.
- If FC processing is slow, pre-trigger with the job runner curl command.
- The replay endpoint injects a fresh Message-ID each time, so it is safe to
  demo multiple times without duplicate-detection blocking it.
- Keep browser DevTools closed during the demo to avoid distraction.
- Rehearsal target: **2:45** — gives a 15-second buffer for live surprises.
