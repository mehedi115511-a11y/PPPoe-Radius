-- PPPOE-02: explicit tenant pool/router relationships and immutable synchronization audit.
-- Production execution requires the separately approved release procedure.
BEGIN;
ALTER TABLE app_ip_pools ADD COLUMN IF NOT EXISTS router_id bigint;
ALTER TABLE app_ip_pools ADD COLUMN IF NOT EXISTS remote_name varchar(80);
ALTER TABLE app_ip_pools ADD COLUMN IF NOT EXISTS sync_status varchar(16) NOT NULL DEFAULT 'Local'
  CHECK (sync_status IN ('Local','Synced','Drifted','Error'));
ALTER TABLE app_ip_pools ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS app_ip_pools_id_owner_unique ON app_ip_pools(id,owner_user_id);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_ip_pools_router_owner_required') THEN
  ALTER TABLE app_ip_pools ADD CONSTRAINT app_ip_pools_router_owner_required
   CHECK (router_id IS NULL OR owner_user_id IS NOT NULL);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_ip_pools_router_owner_fk') THEN
  ALTER TABLE app_ip_pools ADD CONSTRAINT app_ip_pools_router_owner_fk
   FOREIGN KEY(router_id,owner_user_id) REFERENCES app_routers(id,owner_user_id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS app_ip_pools_owner_router_remote_unique
 ON app_ip_pools(owner_user_id,router_id,remote_name) WHERE router_id IS NOT NULL AND remote_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_ip_pools_router_idx ON app_ip_pools(router_id) WHERE router_id IS NOT NULL;
ALTER TABLE app_clients ADD COLUMN IF NOT EXISTS ip_pool_id bigint;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_clients_pool_owner_required') THEN
  ALTER TABLE app_clients ADD CONSTRAINT app_clients_pool_owner_required CHECK(ip_pool_id IS NULL OR owner_user_id IS NOT NULL);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='app_clients_pool_owner_fk') THEN
  ALTER TABLE app_clients ADD CONSTRAINT app_clients_pool_owner_fk FOREIGN KEY(ip_pool_id,owner_user_id)
   REFERENCES app_ip_pools(id,owner_user_id) ON DELETE RESTRICT;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS app_clients_ip_pool_idx ON app_clients(ip_pool_id) WHERE ip_pool_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS app_ip_pool_audit(
 id bigserial PRIMARY KEY,pool_id bigint,router_id bigint,owner_user_id bigint NOT NULL REFERENCES app_users(id),
 actor_user_id bigint NOT NULL REFERENCES app_users(id),action varchar(24) NOT NULL,
 outcome varchar(16) NOT NULL CHECK(outcome IN('Succeeded','Failed','Compensated')),
 details jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_ip_pool_audit_owner_idx ON app_ip_pool_audit(owner_user_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION reject_ip_pool_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IP pool audit is append-only' USING ERRCODE='55000'; END $$;
DROP TRIGGER IF EXISTS app_ip_pool_audit_immutable ON app_ip_pool_audit;
CREATE TRIGGER app_ip_pool_audit_immutable BEFORE UPDATE OR DELETE ON app_ip_pool_audit
 FOR EACH ROW EXECUTE FUNCTION reject_ip_pool_audit_mutation();
GRANT SELECT,INSERT,UPDATE,DELETE ON app_ip_pools TO pppoe_app;
GRANT SELECT,UPDATE ON app_clients TO pppoe_app;
GRANT SELECT,INSERT ON app_ip_pool_audit TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE app_ip_pool_audit_id_seq TO pppoe_app;
COMMIT;
-- Rollback after export/dependency review: remove trigger/table, client/pool columns, FKs and indexes in reverse order.
