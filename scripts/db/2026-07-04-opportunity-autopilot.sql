BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE email_records
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processing','completed','failed')),
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_processing_error text,
  ADD COLUMN IF NOT EXISTS message_domain text,
  ADD COLUMN IF NOT EXISTS structured_extraction jsonb,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS raw_mime bytea;

CREATE UNIQUE INDEX IF NOT EXISTS email_records_user_content_hash_idx
  ON email_records(user_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_roles jsonb NOT NULL DEFAULT '[]',
  locations jsonb NOT NULL DEFAULT '[]',
  remote_preference text NOT NULL DEFAULT 'either',
  target_companies jsonb NOT NULL DEFAULT '[]',
  immediate_alert_events jsonb NOT NULL DEFAULT '[]',
  deal_preferences jsonb NOT NULL DEFAULT '{}',
  freeform_instruction text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company text NOT NULL,
  normalized_company text NOT NULL,
  role text NOT NULL,
  normalized_role text NOT NULL,
  location text,
  application_reference text,
  current_stage text NOT NULL DEFAULT 'applied',
  outcome text NOT NULL DEFAULT 'active',
  latest_confidence double precision NOT NULL DEFAULT 0,
  next_action text,
  next_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunities_user_idx ON opportunities(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS opportunity_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  email_record_id uuid REFERENCES email_records(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_at timestamptz,
  deadline_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '[]',
  confidence double precision NOT NULL,
  confirmation_status text NOT NULL DEFAULT 'automatic',
  extraction jsonb NOT NULL,
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, email_record_id, event_type)
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opportunity_event_id uuid REFERENCES opportunity_events(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  execution_result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_processing_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email_record_id uuid NOT NULL UNIQUE REFERENCES email_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_processing_jobs_status_idx
  ON email_processing_jobs(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS valuable_deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_record_id uuid NOT NULL UNIQUE REFERENCES email_records(id) ON DELETE CASCADE,
  brand text NOT NULL,
  offer_type text NOT NULL,
  offer_value text,
  expires_at timestamptz,
  matched_rule text NOT NULL,
  relevance_reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
