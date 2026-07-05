-- Enable user-managed categories (add/remove) and bind prompts to category models.
-- Intended to run after earlier Phase 6 migrations.

BEGIN;

CREATE TABLE IF NOT EXISTS user_categories (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_key text        NOT NULL,
  display_name text        NOT NULL,
  is_active    boolean     NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, category_key)
);

-- Remove old fixed-category check constraints from user_category_prompts.category.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'user_category_prompts'::regclass
      AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE user_category_prompts DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

-- Seed category models for existing users.
INSERT INTO user_categories (user_id, category_key, display_name)
SELECT u.id, c.category_key, c.display_name
FROM users u
CROSS JOIN (
  VALUES
    ('newsletter', 'Newsletter'),
    ('alert', 'Alerts'),
    ('personal', 'Personal'),
    ('promotion', 'Promotions'),
    ('other', 'Other')
) AS c(category_key, display_name)
ON CONFLICT (user_id, category_key) DO NOTHING;

-- Ensure every existing prompt has a matching category row.
INSERT INTO user_categories (user_id, category_key, display_name)
SELECT p.user_id,
       p.category,
       INITCAP(REPLACE(REPLACE(p.category, '_', ' '), '-', ' '))
FROM user_category_prompts p
LEFT JOIN user_categories uc
  ON uc.user_id = p.user_id
 AND uc.category_key = p.category
WHERE uc.id IS NULL
ON CONFLICT (user_id, category_key) DO NOTHING;

-- Add FK between prompts and category model if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'user_category_prompts'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'user_category_prompts_user_id_category_fkey'
  ) THEN
    ALTER TABLE user_category_prompts
      ADD CONSTRAINT user_category_prompts_user_id_category_fkey
      FOREIGN KEY (user_id, category)
      REFERENCES user_categories (user_id, category_key)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_user_categories_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_categories_updated_at ON user_categories;
CREATE TRIGGER trg_user_categories_updated_at
BEFORE UPDATE ON user_categories
FOR EACH ROW EXECUTE FUNCTION set_user_categories_updated_at();

-- Update seed trigger so new users also get category model rows.
CREATE OR REPLACE FUNCTION seed_default_category_prompts()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_categories (user_id, category_key, display_name)
  VALUES
    (NEW.id, 'newsletter', 'Newsletter'),
    (NEW.id, 'alert', 'Alerts'),
    (NEW.id, 'personal', 'Personal'),
    (NEW.id, 'promotion', 'Promotions'),
    (NEW.id, 'other', 'Other')
  ON CONFLICT (user_id, category_key) DO NOTHING;

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

COMMIT;
