#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
CREATE ROLE pppoe_app LOGIN;
CREATE TABLE app_users(id bigint PRIMARY KEY);
INSERT INTO app_users VALUES(1),(2);
CREATE TABLE app_clients(id bigint PRIMARY KEY,owner_user_id bigint REFERENCES app_users(id));
CREATE TABLE app_packages(id bigint PRIMARY KEY,owner_user_id bigint REFERENCES app_users(id));
SQL
psql -v ON_ERROR_STOP=1 -q -f server/migrations/014_tenant_ip_pools.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/015_router_nas_catalog.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/016_router_nas_encrypted_secrets.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/019_ip_pool_router_sync.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/019_ip_pool_router_sync.sql postgres
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
INSERT INTO app_routers(id,owner_user_id,name,host) VALUES(10,1,'pool-router','127.0.0.1');
INSERT INTO app_ip_pools(id,owner_user_id,name,network,router_id) VALUES(20,1,'Subscribers','10.20.0.0/24',10);
INSERT INTO app_clients(id,owner_user_id,ip_pool_id) VALUES(30,1,20);
DO $$ BEGIN
 BEGIN INSERT INTO app_clients(id,owner_user_id,ip_pool_id) VALUES(31,2,20);
  RAISE EXCEPTION 'cross-tenant pool assignment accepted'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 INSERT INTO app_ip_pool_audit(pool_id,router_id,owner_user_id,actor_user_id,action,outcome) VALUES(20,10,1,1,'Readback','Succeeded');
 BEGIN UPDATE app_ip_pool_audit SET outcome='Failed';
  RAISE EXCEPTION 'audit update accepted'; EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 BEGIN DELETE FROM app_ip_pool_audit;
  RAISE EXCEPTION 'audit delete accepted'; EXCEPTION WHEN SQLSTATE '55000' THEN NULL; END;
 IF NOT has_table_privilege('pppoe_app','app_ip_pool_audit','INSERT') THEN RAISE EXCEPTION 'audit insert grant missing'; END IF;
 IF has_table_privilege('pppoe_app','app_ip_pool_audit','UPDATE') THEN RAISE EXCEPTION 'audit update grant unsafe'; END IF;
END $$;
SQL
echo 'IP_POOL_MIGRATION_TWICE_PASS constraints=1 immutable=1 grants=1'
