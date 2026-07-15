-- Normalize legacy/null categories to 'other' to avoid null bucket in sidebar.

BEGIN;

UPDATE email_records
SET category = 'other'
WHERE category IS NULL OR btrim(category) = '';

COMMIT;
