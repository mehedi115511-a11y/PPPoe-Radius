-- PPPOE-01: explicit router identities; never infer legacy router ownership by name or address.
-- Production migration requires a separate deployment lock and approval.
BEGIN;
ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS router_id bigint;
ALTER TABLE app_packages ADD COLUMN IF NOT EXISTS router_id bigint;
ALTER TABLE app_clients ADD CONSTRAINT app_clients_router_owner_fk
  FOREIGN KEY (router_id, owner_user_id) REFERENCES app_routers(id, owner_user_id) ON DELETE RESTRICT;
ALTER TABLE app_packages ADD CONSTRAINT app_packages_router_owner_fk
  FOREIGN KEY (router_id, owner_user_id) REFERENCES app_routers(id, owner_user_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS app_clients_router_id_idx ON app_clients(router_id) WHERE router_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_packages_router_id_idx ON app_packages(router_id) WHERE router_id IS NOT NULL;
-- Deliberately leave existing router_id NULL; manual, authorized reconciliation is required.
COMMIT;
