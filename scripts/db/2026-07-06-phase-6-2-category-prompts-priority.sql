-- Add category-specific prompts per user and priority flag on emails.
-- Safe additive migration for existing databases.

BEGIN;

ALTER TABLE email_records
  ADD COLUMN IF NOT EXISTS is_priority boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS email_records_user_priority_idx
  ON email_records (user_id, is_priority, received_at DESC);

CREATE TABLE IF NOT EXISTS user_category_prompts (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   text        NOT NULL CHECK (category IN ('newsletter','alert','personal','promotion','other')),
  prompt     text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, category)
);

CREATE OR REPLACE FUNCTION set_user_category_prompts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_category_prompts_updated_at ON user_category_prompts;
CREATE TRIGGER trg_user_category_prompts_updated_at
BEFORE UPDATE ON user_category_prompts
FOR EACH ROW EXECUTE FUNCTION set_user_category_prompts_updated_at();

CREATE OR REPLACE FUNCTION seed_default_category_prompts()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_category_prompts (user_id, category, prompt)
  VALUES
    (NEW.id, 'newsletter', 'Focus on updates, offers, and unsubscribe relevance. Keep summary concise and surface any deadlines, promo codes, or required confirmations.'),
    (NEW.id, 'alert', 'Treat this as potentially urgent. Extract concrete risks, required actions, and deadlines. Mark priority true if user attention is needed soon.'),
    (NEW.id, 'personal', 'Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.'),
    (NEW.id, 'promotion', 'Focus on deal quality, expiry, and whether action is worthwhile. Prefer archive when value is low or irrelevant.'),
    (NEW.id, 'other', 'Use neutral analysis. Focus on key facts, required actions, and practical next steps.')
  ON CONFLICT (user_id, category) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seed_default_category_prompts ON users;
CREATE TRIGGER trg_seed_default_category_prompts
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION seed_default_category_prompts();

INSERT INTO user_category_prompts (user_id, category, prompt)
SELECT u.id, c.category, c.prompt
FROM users u
CROSS JOIN (
  VALUES
    ('newsletter', 'Focus on updates, offers, and unsubscribe relevance. Keep summary concise and surface any deadlines, promo codes, or required confirmations.'),
    ('alert', 'Treat this as potentially urgent. Extract concrete risks, required actions, and deadlines. Mark priority true if user attention is needed soon.'),
    ('personal', 'Prioritize relationship context and tone. Suggest a helpful draft reply when a response is implied or requested.'),
    ('promotion', 'Focus on deal quality, expiry, and whether action is worthwhile. Prefer archive when value is low or irrelevant.'),
    ('other', 'Use neutral analysis. Focus on key facts, required actions, and practical next steps.')
) AS c(category, prompt)
ON CONFLICT (user_id, category) DO NOTHING;

COMMIT;
