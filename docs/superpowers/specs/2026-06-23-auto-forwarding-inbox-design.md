# Auto-Forwarding Inbox — Design Spec
_Date: 2026-06-23_

## Overview

Replace the Gmail OAuth polling architecture with an event-driven inbound email pipeline. Users set up a Gmail auto-forwarding rule; emails arrive via Cloudflare Email Workers and are processed by the existing Qwen AI pipeline. The frontend becomes a three-panel email client UI.

---

## Architecture & Data Flow

```
Gmail auto-forward rule
        ↓
Cloudflare Email Worker  (agent@yourdomain.com)
        ↓  HTTP POST + X-CF-Secret header
POST /api/inbound  (Alibaba Cloud Function Compute)
        ↓
src/lib/email/parser.ts  (mailparser → Email object)
        ↓
processEmailsBatched()  [unchanged — classify, summarize, embed, rules]
        ↓
PolarDB  (email_records — same schema + additive columns)
        ↓
Three-panel Inbox UI  (same DB queries, new layout)
```

### Auth Change
Google OAuth scope is reduced from `https://mail.google.com/` + `https://www.googleapis.com/auth/calendar` to `profile email` only. This eliminates OAuth verification requirements, refresh token management, and `getGoogleAccessToken()`.

### Cloudflare Email Worker
A small TypeScript file deployed to Cloudflare (separate from the Next.js app). It:
1. Receives the raw MIME `email` event at `agent@yourdomain.com`
2. Reads the email as a `ReadableStream`
3. HTTP POSTs to our Function Compute `/api/inbound` URL with `X-CF-Secret` header
4. Lives at `cloudflare/email-worker.ts` in the repo

### Inbound API Route (`POST /api/inbound`)
1. Validates `X-CF-Secret` header (constant-time compare against `CF_INBOUND_SECRET` env var)
2. Reads raw MIME body from request
3. Calls `src/lib/email/parser.ts` → `Email` object (same type as before)
4. Looks up user by forwarding address (or a single-user mode for hackathon: uses the authenticated user's ID from env)
5. Calls `processEmailsBatched([email], userId, userRules)` — unchanged
6. Returns `200 OK`

---

## UI: Three-Panel Inbox

### Panel 1 — Category Sidebar (left, ~110px)
- App title / logo
- Category filters: All (count) / Alerts / Personal / Newsletter / Promotion / Other
- Selected category highlighted, unread count badges
- Settings link at bottom

### Panel 2 — Email List (middle, ~165px)
- Search bar at top (semantic search via pgvector — existing embeddings)
- Emails sorted by `received_at` DESC
- Each row: sender name, subject, category badge, relative timestamp
- Selected row highlighted with left border accent
- Clicking a row loads it in Panel 3

### Panel 3 — Reading Pane (right, flex)
- **Header:** subject, sender, recipient, timestamp
- **Action bar:**
  - ✓ Approve (green) — marks `action_status = 'approved'`, executes action
  - ✕ Reject (red outline) — marks `action_status = 'rejected'`
  - ↩ Reply — opens `mailto:sender?subject=Re: ...&body=<AI draft>` in default mail client
  - 📅 Add to Cal — downloads `.ics` file (only shown when `calendar_events` is non-empty)
- **AI Summary block** (purple left border)
- **Action Items block** (yellow left border) — extracted todos
- **Rule Match block** (indigo left border) — only shown when rules triggered

### Reply via mailto
The ↩ Reply button is **always available** and is independent of the AI recommended action. `EmailDetail` renders it as an `<a href="mailto:...">` tag pre-filled by the server:
```
mailto:{sender}?subject=Re: {subject}&body={AI-generated draft}
```
User's default mail app handles the send.

`approveAction` for `recommended_action = 'draft_reply'` marks `action_status = 'executed'` in the DB and returns the same `mailto:` URL to the client, which then calls `window.open(url)`. For `recommended_action = 'archive'`: marks `action_status = 'executed'` with no side effect (no Gmail API available). For `recommended_action = 'keep'`: same — marks executed, no side effect.

---

## Calendar

### .ics Download
- `qwen3.7-max` extracts event metadata (title, date/time, description) from emails containing dates/deadlines
- Stored in `email_records.calendar_events jsonb` (array of event objects)
- `GET /api/ics/[emailId]` generates and returns a `text/calendar` file
- "Add to Cal" button only rendered when `calendar_events.length > 0`

### PWA Push Notifications
- `public/manifest.json` — makes app installable (name, icons, theme color, `display: standalone`)
- `public/sw.js` — service worker handles `push` events, shows system notification with title + body
- `POST /api/notifications/subscribe` — saves Web Push subscription to `push_subscriptions` table
- On inbound email with detected calendar event: `/api/inbound` fires Web Push notification to subscribed user

---

## Database Changes

### New column on `email_records`
```sql
alter table email_records
  add column if not exists calendar_events jsonb default '[]';
```

### New table
```sql
create table push_subscriptions (
  id        uuid primary key default uuid_generate_v4(),
  user_id   uuid not null references users(id) on delete cascade,
  endpoint  text not null unique,
  p256dh    text not null,
  auth      text not null,
  created_at timestamptz default now()
);
```

---

## File Changes

### Removed
| File | Reason |
|---|---|
| `src/lib/mcp/gmail.ts` | No Gmail API |
| `src/lib/mcp/calendar.ts` | No Google Calendar API |
| `src/lib/tokens.ts` | No OAuth token refresh |
| `src/app/api/process-emails/route.ts` | Replaced by `/api/inbound` |
| `src/components/dashboard/TriggerButton.tsx` | No manual trigger |
| `src/components/digest/DigestSection.tsx` | Replaced by inbox UI |
| `src/components/digest/EmailCard.tsx` | Replaced by inbox UI |
| `src/components/hitl/ActionQueue.tsx` | Replaced by inbox UI |
| `src/components/hitl/ActionItem.tsx` | Replaced by inbox UI |
| `src/app/dashboard/` | Replaced by `/inbox` |

### Kept Unchanged
- `src/lib/ai/qwen.ts` + `src/lib/ai/processor.ts` — entire AI pipeline
- `src/lib/db.ts` — DB pool
- `src/app/settings/page.tsx` + `src/components/settings/RulesEditor.tsx`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/login/page.tsx`

### Added
| File | Purpose |
|---|---|
| `cloudflare/email-worker.ts` | Cloudflare Email Worker (deployed separately) |
| `src/app/api/inbound/route.ts` | Cloudflare webhook receiver |
| `src/app/api/ics/[emailId]/route.ts` | .ics file download |
| `src/app/api/notifications/subscribe/route.ts` | PWA push subscription |
| `src/app/inbox/page.tsx` | Three-panel inbox (server component) |
| `src/components/inbox/InboxSidebar.tsx` | Category sidebar |
| `src/components/inbox/EmailList.tsx` | Email list panel |
| `src/components/inbox/EmailDetail.tsx` | Reading pane |
| `src/lib/email/parser.ts` | MIME parsing via mailparser |
| `src/lib/ics/generate.ts` | .ics file generation |
| `src/lib/push/notify.ts` | Web Push API wrapper |
| `public/sw.js` | PWA service worker |
| `public/manifest.json` | PWA manifest |

### Modified
| File | Change |
|---|---|
| `src/auth.ts` | Scopes: `profile email` only |
| `src/lib/actions/email-actions.ts` | `approveAction` returns `mailto:` URL for `draft_reply` instead of calling Gmail API |
| `scripts/db/schema.sql` | Add `calendar_events` column + `push_subscriptions` table |

---

## Environment Variables

### Removed
```
# No longer needed
GOOGLE_SCOPES (implicit)
```

### Added
```env
CF_INBOUND_SECRET=        # shared secret between Cloudflare Worker and /api/inbound
VAPID_PUBLIC_KEY=          # Web Push VAPID public key
VAPID_PRIVATE_KEY=         # Web Push VAPID private key
VAPID_SUBJECT=mailto:huckzishere@gmail.com
```

---

## Open Questions
- **Domain for Cloudflare:** Cloudflare Email Workers requires a domain managed by Cloudflare DNS. Do you have one available, or do we need to provision one?
- **Single-user vs multi-user inbound routing:** For the hackathon, single-user (hardcoded userId from env) is simplest. Multi-user would require mapping forwarding addresses per user.
