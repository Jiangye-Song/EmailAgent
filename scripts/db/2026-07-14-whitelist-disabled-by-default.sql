BEGIN;

-- New users and existing users should have sender whitelist filtering disabled
-- until they explicitly enable it in Settings.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whitelist_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE users
  ALTER COLUMN whitelist_enabled SET DEFAULT false;

UPDATE users
SET whitelist_enabled = false
WHERE whitelist_enabled IS DISTINCT FROM false;

COMMIT;
