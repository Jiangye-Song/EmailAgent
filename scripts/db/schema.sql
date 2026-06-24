-- ─── Extensions ────────────────────────────────────────────────────────────
-- pgvector ships in pgvector/pgvector:pg16 image; uuid-ossp is in contrib
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- ─── NextAuth.js v5 tables (@auth/pg-adapter) ───────────────────────────────
create table if not exists users (
  id            uuid        primary key default uuid_generate_v4(),
  name          text,
  email         text        unique,
  "emailVerified" timestamptz,
  image         text
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
  gmail_id           text        not null,
  subject            text,
  sender             text,
  received_at        timestamptz,
  category           text,
  summary            text,
  todos              jsonb       default '[]',
  recommended_action text        check (recommended_action in ('archive','keep','draft_reply')),
  action_status      text        check (action_status in ('pending','approved','rejected','executed')) default 'pending',
  raw_snippet        text,
  embedding          vector(1024),   -- text-embedding-v4 output (1024-dim default)
  attachment_urls    jsonb       default '[]',  -- Gmail attachment download URLs (no OSS in Phase 1)
  processed_at       timestamptz default now()
);

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

-- ─── Phase 6 migration — auto-forwarding inbox ──────────────────────────────

-- Each user gets a unique forwarding address e.g. abc12345@yourdomain.com
alter table users
  add column if not exists forwarding_address text unique;

-- AI-extracted calendar events from email body
alter table email_records
  add column if not exists calendar_events jsonb default '[]';

-- AI-generated draft reply body (populated when recommended_action = 'draft_reply')
alter table email_records
  add column if not exists draft_body text;

-- Unique index so ON CONFLICT (gmail_id, user_id) works for deduplication
create unique index if not exists email_records_gmail_id_user_id_idx
  on email_records (gmail_id, user_id);

-- Web Push subscriptions for PWA notifications
create table if not exists push_subscriptions (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references users(id) on delete cascade,
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz default now()
);
