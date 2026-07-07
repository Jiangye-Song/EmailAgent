BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whitelist_enabled boolean NOT NULL DEFAULT true;
COMMIT;
