-- Task 24: additive tenant ownership identifiers. No role-based backfill is safe.
-- Do NOT apply to production without the release/deployment lock and an explicit
-- owner mapping for legacy rows. NULL is unresolved and must be denied by API.
BEGIN;
ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id);
ALTER TABLE app_packages ADD COLUMN IF NOT EXISTS owner_user_id bigint REFERENCES app_users(id);
CREATE INDEX IF NOT EXISTS app_clients_owner_user_idx ON app_clients(owner_user_id);
CREATE INDEX IF NOT EXISTS app_packages_owner_user_idx ON app_packages(owner_user_id,status);
COMMIT;
-- Backfill requires a reviewed per-record owner mapping, never owner_role alone.
-- Rollback before cutover, after verifying no newly written data uses the columns:
-- DROP INDEX IF EXISTS app_clients_owner_user_idx;
-- DROP INDEX IF EXISTS app_packages_owner_user_idx;
-- ALTER TABLE app_clients DROP COLUMN IF EXISTS owner_user_id;
-- ALTER TABLE app_packages DROP COLUMN IF EXISTS owner_user_id;
