-- PPPOE-01: append-only Router/NAS lifecycle and health evidence.
BEGIN;
CREATE TABLE IF NOT EXISTS app_router_audit (
  id bigserial PRIMARY KEY,
  router_id bigint NOT NULL,
  owner_user_id bigint NOT NULL REFERENCES app_users(id),
  actor_user_id bigint NOT NULL REFERENCES app_users(id),
  action varchar(32) NOT NULL CHECK(action IN ('HealthChecked','Removed')),
  outcome varchar(16) NOT NULL CHECK(outcome IN ('Succeeded','Failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_router_audit_owner_created_idx ON app_router_audit(owner_user_id,created_at DESC,id DESC);
CREATE OR REPLACE FUNCTION prevent_router_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'router audit is append-only'; END $$;
DROP TRIGGER IF EXISTS app_router_audit_immutable ON app_router_audit;
CREATE TRIGGER app_router_audit_immutable BEFORE UPDATE OR DELETE ON app_router_audit FOR EACH ROW EXECUTE FUNCTION prevent_router_audit_mutation();
GRANT SELECT,INSERT ON app_router_audit TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE app_router_audit_id_seq TO pppoe_app;
COMMIT;
-- Rollback only after audit export: DROP TABLE app_router_audit.
