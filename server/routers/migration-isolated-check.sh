#!/usr/bin/env bash
# Run via: pg_virtualenv bash server/routers/migration-isolated-check.sh
# pg_virtualenv owns a disposable cluster and removes it on exit.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
CREATE ROLE pppoe_app LOGIN;
CREATE TABLE app_users (id bigint PRIMARY KEY);
INSERT INTO app_users VALUES (1),(2);
CREATE TABLE app_clients (id bigint PRIMARY KEY, owner_user_id bigint REFERENCES app_users(id));
CREATE TABLE app_packages (id bigint PRIMARY KEY, owner_user_id bigint REFERENCES app_users(id));
SQL
psql -v ON_ERROR_STOP=1 -q -f server/migrations/015_router_nas_catalog.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/016_router_nas_encrypted_secrets.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/017_router_nas_explicit_dependencies.sql postgres
psql -v ON_ERROR_STOP=1 -q -f server/migrations/017_router_nas_explicit_dependencies.sql postgres
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
INSERT INTO app_routers (id,owner_user_id,name,host) VALUES (10,1,'isolated-router','127.0.0.1');
INSERT INTO app_clients (id,owner_user_id,router_id) VALUES (1,1,10);
INSERT INTO app_packages (id,owner_user_id,router_id) VALUES (1,1,10);
DO $$ BEGIN
  BEGIN INSERT INTO app_clients(id,owner_user_id,router_id) VALUES(2,NULL,10);
    RAISE EXCEPTION 'missing-owner client unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO app_packages(id,owner_user_id,router_id) VALUES(2,NULL,10);
    RAISE EXCEPTION 'missing-owner package unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN INSERT INTO app_clients(id,owner_user_id,router_id) VALUES(3,2,10);
    RAISE EXCEPTION 'cross-tenant client unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN INSERT INTO app_packages(id,owner_user_id,router_id) VALUES(3,2,10);
    RAISE EXCEPTION 'cross-tenant package unexpectedly accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF NOT has_table_privilege('pppoe_app','app_router_secrets','DELETE') THEN
    RAISE EXCEPTION 'credential revoke permission missing'; END IF;
  IF has_table_privilege('pppoe_app','app_routers','DELETE') THEN
    RAISE EXCEPTION 'router hard delete must remain forbidden'; END IF;
END $$;
SQL
echo 'ISOLATED_ROUTER_MIGRATIONS_PASS'
