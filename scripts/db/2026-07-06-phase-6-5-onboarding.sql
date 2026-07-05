-- Replace DB-level category seeding with the user-driven onboarding flow.
-- Safe additive migration for existing databases.

BEGIN;

-- ── 1. Onboarding flag ───────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Existing users already have categories — mark them as done.
UPDATE users
SET onboarding_completed = true
WHERE id IN (SELECT DISTINCT user_id FROM user_categories);

-- ── 2. Remove the old auto-seed trigger so onboarding handles seeding ────────
DROP TRIGGER IF EXISTS trg_seed_default_category_prompts ON users;
DROP FUNCTION IF EXISTS seed_default_category_prompts();

COMMIT;
