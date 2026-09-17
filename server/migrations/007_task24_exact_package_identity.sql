-- Task 24: exact package identity for RADIUS sync and client mutation.
-- Legacy package_name is retained for display and historical compatibility.
-- Existing clients stay NULL until a reviewed, explicit client-to-package mapping.
-- Never derive package_id from package_name or owner_role.
BEGIN;
ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS package_id bigint REFERENCES app_packages(id);
CREATE INDEX IF NOT EXISTS app_clients_package_id_idx ON app_clients(package_id);
COMMIT;
-- Rollback ONLY after checking no live client references package_id:
-- DROP INDEX IF EXISTS app_clients_package_id_idx;
-- ALTER TABLE app_clients DROP COLUMN IF EXISTS package_id;
