-- PPPOE-01: explicit router identities; never infer legacy router ownership by name or address.
-- Production migration requires a separate deployment lock and approval.
BEGIN;
ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS router_id bigint;
ALTER TABLE app_packages ADD COLUMN IF NOT EXISTS router_id bigint;
-- Composite FKs use MATCH SIMPLE: reject a populated router_id with a NULL owner explicitly.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_clients_router_owner_required' AND conrelid='app_clients'::regclass) THEN
    ALTER TABLE app_clients ADD CONSTRAINT app_clients_router_owner_required CHECK (router_id IS NULL OR owner_user_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_packages_router_owner_required' AND conrelid='app_packages'::regclass) THEN
    ALTER TABLE app_packages ADD CONSTRAINT app_packages_router_owner_required CHECK (router_id IS NULL OR owner_user_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_clients_router_owner_fk' AND conrelid='app_clients'::regclass) THEN
    ALTER TABLE app_clients ADD CONSTRAINT app_clients_router_owner_fk FOREIGN KEY (router_id,owner_user_id) REFERENCES app_routers(id,owner_user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_packages_router_owner_fk' AND conrelid='app_packages'::regclass) THEN
    ALTER TABLE app_packages ADD CONSTRAINT app_packages_router_owner_fk FOREIGN KEY (router_id,owner_user_id) REFERENCES app_routers(id,owner_user_id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS app_clients_router_id_idx ON app_clients(router_id) WHERE router_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_packages_router_id_idx ON app_packages(router_id) WHERE router_id IS NOT NULL;
-- Deliberately leave existing router_id NULL; authorized reconciliation is required.
COMMIT;
