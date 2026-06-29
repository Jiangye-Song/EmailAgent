-- One-time additive migration for Phase 5.1
-- Safe for existing databases: only adds new columns/indexes, no drops/renames.

BEGIN;

ALTER TABLE email_records
  ADD COLUMN IF NOT EXISTS action_buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- Helpful for unread/starred-heavy inbox filters.
CREATE INDEX IF NOT EXISTS email_records_user_unread_idx
  ON email_records (user_id, is_read, received_at DESC);

CREATE INDEX IF NOT EXISTS email_records_user_starred_idx
  ON email_records (user_id, is_starred, received_at DESC);

COMMIT;
