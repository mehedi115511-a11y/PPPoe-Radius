-- Task 24: same package name may be used by distinct reconciled owners.
-- Guardrail: do not run on production without approved migration/cutover.
-- Existing NULL-owned legacy packages remain unresolved and inaccessible.
-- Review duplicate (owner_user_id,name) rows before applying; creation of the
-- unique index intentionally fails rather than arbitrarily deleting records.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS app_packages_owner_name_unique
  ON app_packages(owner_user_id, name) WHERE owner_user_id IS NOT NULL;
ALTER TABLE app_packages DROP CONSTRAINT IF EXISTS app_packages_name_owner_role_key;
COMMIT;
-- Rollback requires checking whether duplicate role/name pairs were created:
-- ALTER TABLE app_packages ADD CONSTRAINT app_packages_name_owner_role_key UNIQUE(name,owner_role);
-- DROP INDEX IF EXISTS app_packages_owner_name_unique;
