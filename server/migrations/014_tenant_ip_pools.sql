-- Tenant-owned software IP pool catalog. RouterOS provisioning is separate.
BEGIN;
CREATE TABLE IF NOT EXISTS app_ip_pools (
 id bigserial PRIMARY KEY,
 owner_user_id bigint NOT NULL REFERENCES app_users(id),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
 network cidr NOT NULL,
 status text NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Disabled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_user_id,name),
 UNIQUE(owner_user_id,network)
);
CREATE INDEX IF NOT EXISTS app_ip_pools_owner_idx ON app_ip_pools(owner_user_id,id);
GRANT SELECT,INSERT,UPDATE,DELETE ON app_ip_pools TO pppoe_app;
GRANT USAGE,SELECT ON SEQUENCE app_ip_pools_id_seq TO pppoe_app;
COMMIT;
-- Rollback after export and dependency review: DROP TABLE app_ip_pools.
