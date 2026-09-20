-- PPPOE-01: software-only router catalog; this migration never configures a device.
BEGIN;
CREATE TABLE IF NOT EXISTS app_routers (
  id bigserial PRIMARY KEY,
  owner_user_id bigint NOT NULL REFERENCES app_users(id),
  name varchar(80) NOT NULL,
  host varchar(253) NOT NULL,
  port integer NOT NULL DEFAULT 8729 CHECK (port BETWEEN 1 AND 65535),
  router_os_version varchar(1) NOT NULL DEFAULT '7' CHECK (router_os_version IN ('6','7')),
  status varchar(8) NOT NULL DEFAULT 'Disabled' CHECK (status IN ('Active','Disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT app_routers_owner_name_unique UNIQUE (owner_user_id,name)
);
CREATE INDEX IF NOT EXISTS app_routers_owner_active_idx ON app_routers(owner_user_id,id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS app_routers_owner_endpoint_unique ON app_routers(owner_user_id,host,port) WHERE deleted_at IS NULL;
-- No passwords, shared secrets or API tokens are stored in this catalog.
-- Credential storage requires separate authenticated envelope-encryption work.
COMMIT;
