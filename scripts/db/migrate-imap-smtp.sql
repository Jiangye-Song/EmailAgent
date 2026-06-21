-- Migration: imap-smtp refactor
-- Run this against an existing database. Safe to run more than once.

-- 1. Rename gmail_id → message_id in email_records
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_records' AND column_name = 'gmail_id'
  ) THEN
    ALTER TABLE email_records RENAME COLUMN gmail_id TO message_id;
    RAISE NOTICE 'Renamed gmail_id → message_id';
  ELSE
    RAISE NOTICE 'Column message_id already exists, skipping rename';
  END IF;
END
$$;

-- 2. Add email_credentials table
CREATE TABLE IF NOT EXISTS email_credentials (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  imap_host  TEXT        NOT NULL,
  imap_port  INT         NOT NULL DEFAULT 993,
  smtp_host  TEXT        NOT NULL,
  smtp_port  INT         NOT NULL DEFAULT 587,
  username   TEXT        NOT NULL,
  -- AES-256-GCM encrypted: <iv_hex>:<tag_hex>:<ciphertext_hex>
  secret_enc TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
