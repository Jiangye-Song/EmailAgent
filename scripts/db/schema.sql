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
  is_priority        boolean     not null default false,
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
create index if not exists email_records_user_priority_idx
  on email_records (user_id, is_priority, received_at desc);

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

-- User-managed categories. Users can add/remove categories over time.
create table if not exists user_categories (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references users(id) on delete cascade,
  category_key text        not null,
  display_name text        not null,
  is_active    boolean     not null default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id, category_key)
);

-- Per-user category prompt used by the category-specialist analysis agent.
create table if not exists user_category_prompts (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references users(id) on delete cascade,
  category   text        not null,
  prompt     text        not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, category),
  foreign key (user_id, category) references user_categories (user_id, category_key) on delete cascade
);

create or replace function set_user_category_prompts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function set_user_categories_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_user_category_prompts_updated_at on user_category_prompts;
create trigger trg_user_category_prompts_updated_at
before update on user_category_prompts
for each row execute function set_user_category_prompts_updated_at();

drop trigger if exists trg_user_categories_updated_at on user_categories;
create trigger trg_user_categories_updated_at
before update on user_categories
for each row execute function set_user_categories_updated_at();

create or replace function seed_default_category_prompts()
returns trigger as $$
begin
  insert into user_categories (user_id, category_key, display_name)
  values
    (new.id, 'newsletter', 'Newsletter'),
    (new.id, 'alert', 'Alerts'),
    (new.id, 'personal', 'Personal'),
    (new.id, 'promotion', 'Promotions'),
    (new.id, 'other', 'Other')
  on conflict (user_id, category_key) do nothing;

  insert into user_category_prompts (user_id, category, prompt)
  values
    (new.id, 'newsletter', 'Focus on updates, offers, and unsubscribe relevance. Keep summary concise and surface any deadlines, promo codes, or required confirmations.'),
    (new.id, 'alert', 'Treat this as potentially urgent. Extract concrete risks, required actions, and deadlines. Mark priority true if user attention is needed soon.'),
    (new.id, 'personal', 'Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.'),
    (new.id, 'promotion', 'Focus on deal quality, expiry, and whether action is worthwhile. Prefer archive when value is low or irrelevant.'),
    (new.id, 'other', 'Use neutral analysis. Focus on key facts, required actions, and practical next steps.')
  on conflict (user_id, category) do nothing;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_seed_default_category_prompts on users;
create trigger trg_seed_default_category_prompts
after insert on users
for each row execute function seed_default_category_prompts();

insert into user_categories (user_id, category_key, display_name)
select u.id, c.category_key, c.display_name
from users u
cross join (
  values
    ('newsletter', 'Newsletter'),
    ('alert', 'Alerts'),
    ('personal', 'Personal'),
    ('promotion', 'Promotions'),
    ('other', 'Other')
) as c(category_key, display_name)
on conflict (user_id, category_key) do nothing;

insert into user_category_prompts (user_id, category, prompt)
select u.id, c.category, c.prompt
from users u
cross join (
  values
    ('newsletter', 'Focus on updates, offers, and unsubscribe relevance. Keep summary concise and surface any deadlines, promo codes, or required confirmations.'),
    ('alert', 'Treat this as potentially urgent. Extract concrete risks, required actions, and deadlines. Mark priority true if user attention is needed soon.'),
    ('personal', 'Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.'),
    ('promotion', 'Focus on deal quality, expiry, and whether action is worthwhile. Prefer archive when value is low or irrelevant.'),
    ('other', 'Use neutral analysis. Focus on key facts, required actions, and practical next steps.')
) as c(category, prompt)
on conflict (user_id, category) do nothing;

-- Authorized senders who can forward to each user's address
create table if not exists sender_whitelist (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references users(id) on delete cascade,
  sender_email   text        not null,   -- exact match, e.g. "john@company.com"
  sender_domain  text,                  -- domain match, e.g. "company.com" (optional)
  created_at     timestamptz default now(),
  unique (user_id, sender_email)
);
