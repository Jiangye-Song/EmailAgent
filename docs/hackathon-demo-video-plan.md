# EmailAgent Hackathon Demo Video Plan

## Goal

Create a clear, honest screencast that lets judges understand three things quickly:

1. The problem: an overloaded inbox causes important messages and opportunities to be missed.
2. The solution: EmailAgent turns forwarded email into prioritized, actionable decisions.
3. The proof: the product works end to end, with AI recommendations and a human approval step.

Recommended final length: **2:45-3:30**.

## Core Story

> EmailAgent is an AI inbox assistant for people who are overwhelmed by email. Forward a message to a personal EmailAgent address, and it is classified, summarized, and converted into suggested actions. The user stays in control by reviewing recommendations before taking action.

Keep this story consistent throughout the video. The demo should feel like one realistic email moving through the product, not a tour of every feature.

## Video Structure And Timeline

| Time | Section | What to show | What to say |
|---|---|---|---|
| 0:00-0:15 | Hook and elevator pitch | Start on the dashboard with a high-value email visible. Quickly show the before/after contrast: a messy inbox becomes a short list of decisions. | “When an inbox gets overloaded, important opportunities are easy to miss. EmailAgent uses AI to turn forwarded emails into clear, prioritized actions, while keeping the final decision with the user.” |
| 0:15-0:35 | The use case | Show the unique forwarding address and a sample incoming email, such as a job opportunity, meeting request, or time-sensitive customer message. | “Instead of replacing a user’s email provider, EmailAgent gives each user a forwarding address. That makes the workflow provider-agnostic and simple to adopt.” |
| 0:35-1:05 | Inbound processing | Trigger or reveal the forwarded email arriving in the EmailAgent inbox. If available, briefly show the processing state, category, priority, and generated summary. | “Cloudflare Email Routing sends the message to our webhook. We parse the MIME email, run AI analysis, and store structured results for the dashboard.” |
| 1:05-1:40 | AI analysis in the dashboard | Open the email detail view. Highlight category, urgency or priority, concise summary, extracted action items, and any detected date or deadline. | “The first pass is handled by AI: EmailAgent classifies the message, summarizes it, and extracts the actions that matter. The user does not have to read every line to understand what needs attention.” |
| 1:40-2:10 | Human-in-the-loop decision | Open the approval queue. Approve one suggested action and reject or leave another pending. Make the status change visible. | “AI makes recommendations, but it does not silently act on the user’s behalf. High-impact actions go through a human-in-the-loop approval flow, so the user can approve, reject, or defer each recommendation.” |
| 2:10-2:35 | One-click outcomes | Demonstrate a `mailto` reply link. Then show an event or calendar-related email and export it as an ICS file. | “For replies, EmailAgent opens a ready-to-use `mailto` flow. For calendar content, it generates an ICS file for one-click import. These actions are fast, transparent, and work without fragile provider-specific integrations.” |
| 2:35-2:55 | Notifications and practical value | Show the push notification or notification state, then return to the dashboard with the remaining work clearly prioritized. | “Push notifications keep users informed without forcing them to constantly check another inbox. The result is a smaller, calmer queue of decisions.” |
| 2:55-3:20 | How it was built | Show a simple architecture diagram or code/editor view only if it is clean and readable: forwarding address → Cloudflare → webhook → Qwen analysis → PostgreSQL/pgvector → dashboard. | “We built this with Next.js 16, TypeScript, PostgreSQL with pgvector, Cloudflare Email Routing, and Qwen models for classification, summarization, rules, and embeddings.” |
| 3:20-3:30 | Close | Return to the strongest dashboard view. Keep the product on screen while delivering the final line. | “EmailAgent helps people stop avoiding email and start with the decisions that matter. The goal is not full automation; it is useful automation that people can trust.” |

## Demonstration Path

Prepare one compelling sample email before recording. The recommended path is a time-sensitive career opportunity because it connects directly to the project story:

1. Show a forwarded opportunity email arriving at the personal EmailAgent address.
2. Show the AI-generated category, priority, and summary.
3. Show extracted actions such as “reply by Friday” or “choose an interview time.”
4. Approve the suggested reply action in the human-in-the-loop queue.
5. Open the one-click reply flow with `mailto`.
6. Briefly show a second email that produces a calendar event and export its ICS file.
7. End on the prioritized dashboard and notification state.

Use a second email only to prove the calendar workflow. Avoid demonstrating several similar emails; repetition will make the video feel longer without adding proof.

## What To Emphasize

- **Provider-agnostic design:** forwarding works across email providers and avoids depending on restricted direct mailbox access.
- **Human control:** AI recommends; the user approves consequential actions.
- **Speed to usefulness:** summaries, action extraction, `mailto` replies, and ICS export reduce friction.
- **End-to-end implementation:** the video should prove the path from inbound email to useful action, not just show a static UI.
- **Personal motivation:** the product exists to reduce email avoidance and prevent missed opportunities.

## What To Avoid

- Do not spend the opening on the technology stack or architecture.
- Do not claim that the system sends or executes actions automatically if the current workflow opens a link or produces an export.
- Do not show secrets, private email addresses, API keys, real personal messages, or unblurred notification content.
- Do not narrate every button. Explain the user outcome and let the interface prove it.
- Do not use a heavily edited marketing montage as the main demo. Keep the product interaction authentic and easy to evaluate.
- Do not pause on loading screens, setup mistakes, empty states, or repeated navigation.

## Recording Plan

### Before recording

- Seed the demo account with the exact sample emails and expected AI results.
- Confirm the forwarding/webhook path is working, or prepare a realistic pre-processed message for a stable screencast.
- Check that the dashboard starts in the strongest state and that the browser zoom makes text readable.
- Prepare a clean architecture diagram for the short technical section.
- Close unrelated tabs, notifications, terminals, and personal data.
- Rehearse the path until the complete run takes less than four minutes.

### During recording

- Record the screen at 1080p or higher with the browser cursor visible but calm.
- Use a clear microphone recording and speak slightly slower than normal conversation.
- Keep narration focused on “what happened” and “why it matters.”
- Pause for one second after important UI changes so judges can read them.
- Capture separate takes for the hook, product demo, and technical explanation if that makes editing easier.

### Editing

- Remove dead time, failed clicks, typing, and long loading states.
- Add short, readable labels only when they clarify a step, such as “AI summary” or “Human approval.”
- Keep the real product UI on screen for most of the runtime.
- Use light cuts between prepared states, but preserve enough continuity that the workflow remains believable.
- Add captions or subtitles for accessibility and noisy viewing environments.
- Export an MP4 at 1080p, watch the full export once, and upload early enough to catch processing issues.

## Narration Notes

Use a conversational tone. The story is personal, but the demo should remain concrete:

- Start with the consequence: “I started avoiding email, and that meant missing important opportunities.”
- Move immediately to the product: “EmailAgent gives me a prioritized set of decisions instead of an overwhelming stream.”
- Explain the architecture pivot briefly: “Because direct provider integrations can be restricted or unreliable, we designed around forwarding.”
- End on trust: “The system handles the first pass, but the user remains in control.”

## Final Quality Checklist

- [ ] The product and problem are clear within the first 15 seconds.
- [ ] A real email is shown moving through the complete workflow.
- [ ] AI classification, summary, and action extraction are visible.
- [ ] Approval and rejection or deferral are demonstrated.
- [ ] `mailto` and ICS workflows are shown accurately.
- [ ] The forwarding architecture and hackathon-relevant implementation are explained.
- [ ] No secrets or private data appear on screen.
- [ ] The final video is under four minutes, readable, captioned, and free of dead time.
