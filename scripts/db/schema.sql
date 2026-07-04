-- ─── Extensions ────────────────────────────────────────────────────────────
-- pgvector ships in pgvector/pgvector:pg16 image; uuid-ossp is in contrib
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ─── NextAuth.js v5 tables (@auth/pg-adapter) ───────────────────────────────
create table if not exists users (
  id                  uuid        primary key default uuid_generate_v4(),
  name                text,
  email               text        unique not null,
  "emailVerified"     timestamptz,
  image               text,
  password_hash       text,                    -- bcrypt hash (null for OAuth users)
  forwarding_address  text        unique,      -- e.g. abc12345@emailagent.top
  created_at          timestamptz default now()
);

create table if not exists accounts (
  id                  uuid  primary key default uuid_generate_v4(),
  "userId"            uuid  not null references users(id) on delete cascade,
  type                text  not null,
  provider            text  not null,
  "providerAccountId" text  not null,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  unique (provider, "providerAccountId")
);

create table if not exists sessions (
  id             uuid        primary key default uuid_generate_v4(),
  "sessionToken" text        unique not null,
  "userId"       uuid        not null references users(id) on delete cascade,
  expires        timestamptz not null
);

create table if not exists verification_tokens (
  identifier text        not null,
  token      text        not null,
  expires    timestamptz not null,
  primary key (identifier, token)
);

-- ─── Application tables ─────────────────────────────────────────────────────
create table if not exists email_records (
  id                 uuid        primary key default uuid_generate_v4(),
  user_id            uuid        not null references users(id) on delete cascade,
  message_id         text        not null,
  subject            text,
  sender             text,
  received_at        timestamptz,
  category           text,
  summary            text,
  todos              jsonb       default '[]',
  action_buttons     jsonb       default '[]',
  is_read            boolean     not null default false,
  is_starred         boolean     not null default false,
  recommended_action text        check (recommended_action in ('archive','keep','draft_reply')),
  action_status      text        check (action_status in ('pending','approved','rejected','executed')) default 'pending',
  raw_body           text,                             -- full plain-text body of the forwarded email
  draft_body         text,                             -- AI-generated draft reply (Phase 5)
  calendar_events    jsonb       default '[]',          -- AI-extracted calendar events (Phase 5)
  embedding          vector(1024),                     -- text-embedding-v4 output (1024-dim default)
  attachment_urls    jsonb       default '[]',          -- attachment metadata from forwarded email
  processed_at       timestamptz default now()
);

create index if not exists email_records_user_idx    on email_records (user_id);
create index if not exists email_records_received_idx on email_records (received_at desc);

create index if not exists email_records_embedding_idx
  on email_records using hnsw (embedding vector_cosine_ops);

-- Digest exports stored as JSONB (no OSS in Phase 1; move to OSS in Phase 2)
create table if not exists digest_exports (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references users(id) on delete cascade,
  date        date        not null,
  payload     jsonb       not null,  -- full digest JSON
  created_at  timestamptz default now(),
  unique (user_id, date)
);

create table if not exists user_rules (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references users(id) on delete cascade,
  rule_text  text        not null,
  created_at timestamptz default now()
);

-- Authorized senders who can forward to each user's address
create table if not exists sender_whitelist (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references users(id) on delete cascade,
  sender_email   text        not null,   -- exact match, e.g. "john@company.com"
  sender_domain  text,                  -- domain match, e.g. "company.com" (optional)
  created_at     timestamptz default now(),
  unique (user_id, sender_email)
);

-- ─── Opportunity Autopilot (2026-07-04) ─────────────────────────────────────

alter table users add column if not exists onboarding_completed boolean not null default false;

alter table email_records
  add column if not exists processing_status text not null default 'received'
    check (processing_status in ('received','processing','completed','failed')),
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists last_processing_error text,
  add column if not exists message_domain text,
  add column if not exists structured_extraction jsonb,
  add column if not exists content_hash text,
  add column if not exists raw_mime bytea;

create unique index if not exists email_records_user_content_hash_idx
  on email_records(user_id, content_hash)
  where content_hash is not null;

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  target_roles jsonb not null default '[]',
  locations jsonb not null default '[]',
  remote_preference text not null default 'either',
  target_companies jsonb not null default '[]',
  immediate_alert_events jsonb not null default '[]',
  deal_preferences jsonb not null default '{}',
  freeform_instruction text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  company text not null,
  normalized_company text not null,
  role text not null,
  normalized_role text not null,
  location text,
  application_reference text,
  current_stage text not null default 'applied',
  outcome text not null default 'active',
  latest_confidence double precision not null default 0,
  next_action text,
  next_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_user_idx on opportunities(user_id, updated_at desc);

create table if not exists opportunity_events (
  id uuid primary key default uuid_generate_v4(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  email_record_id uuid references email_records(id) on delete set null,
  event_type text not null,
  event_at timestamptz,
  deadline_at timestamptz,
  evidence jsonb not null default '[]',
  confidence double precision not null,
  confirmation_status text not null default 'automatic',
  extraction jsonb not null,
  digest_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(opportunity_id, email_record_id, event_type)
);

create table if not exists agent_actions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  opportunity_event_id uuid references opportunity_events(id) on delete cascade,
  action_type text not null,
  payload jsonb not null,
  status text not null default 'proposed',
  execution_result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_processing_jobs (
  id uuid primary key default uuid_generate_v4(),
  email_record_id uuid not null unique references email_records(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists valuable_deals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  email_record_id uuid not null unique references email_records(id) on delete cascade,
  brand text not null,
  offer_type text not null,
  offer_value text,
  expires_at timestamptz,
  matched_rule text not null,
  relevance_reason text not null,
  created_at timestamptz not null default now()
);
