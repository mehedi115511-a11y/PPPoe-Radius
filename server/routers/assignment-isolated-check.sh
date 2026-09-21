#!/usr/bin/env bash
# Run only with pg_virtualenv: disposable PostgreSQL, no production DB.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
CREATE ROLE pppoe_app LOGIN;
CREATE TABLE app_users (id bigint PRIMARY KEY);
INSERT INTO app_users VALUES (1),(2);
CREATE TABLE app_clients (id bigint PRIMARY KEY, owner_user_id bigint REFERENCES app_users(id));
CREATE TABLE app_packages (id bigint PRIMARY KEY, owner_user_id bigint REFERENCES app_users(id));
SQL
for migration in 015_router_nas_catalog 016_router_nas_encrypted_secrets 017_router_nas_explicit_dependencies; do
  psql -v ON_ERROR_STOP=1 -q -f "server/migrations/${migration}.sql" postgres
done
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
INSERT INTO app_routers(id,owner_user_id,name,host) VALUES (10,1,'router-a','127.0.0.1'),(20,2,'router-b','127.0.0.2');
INSERT INTO app_clients(id,owner_user_id) VALUES (1,1),(2,2),(3,NULL);
INSERT INTO app_packages(id,owner_user_id) VALUES (1,1),(2,2);
DO $$ DECLARE affected integer; BEGIN
  UPDATE app_clients AS item SET router_id=10 WHERE item.id=1 AND item.owner_user_id=1 AND item.router_id IS NULL AND EXISTS (SELECT 1 FROM app_routers r WHERE r.id=10 AND r.owner_user_id=1 AND r.deleted_at IS NULL);
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'valid client assignment failed'; END IF;
  UPDATE app_clients AS item SET router_id=20 WHERE item.id=1 AND item.owner_user_id=1 AND item.router_id IS NULL AND EXISTS (SELECT 1 FROM app_routers r WHERE r.id=20 AND r.owner_user_id=1 AND r.deleted_at IS NULL);
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'cross-tenant reassignment accepted'; END IF;
  UPDATE app_clients AS item SET router_id=10 WHERE item.id=3 AND item.owner_user_id=1 AND item.router_id IS NULL AND EXISTS (SELECT 1 FROM app_routers r WHERE r.id=10 AND r.owner_user_id=1 AND r.deleted_at IS NULL);
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'unowned client accepted'; END IF;
  UPDATE app_packages AS item SET router_id=10 WHERE item.id=1 AND item.owner_user_id=1 AND item.router_id IS NULL AND EXISTS (SELECT 1 FROM app_routers r WHERE r.id=10 AND r.owner_user_id=1 AND r.deleted_at IS NULL);
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'valid package assignment failed'; END IF;
  UPDATE app_packages AS item SET router_id=10 WHERE item.id=2 AND item.owner_user_id=1 AND item.router_id IS NULL AND EXISTS (SELECT 1 FROM app_routers r WHERE r.id=10 AND r.owner_user_id=1 AND r.deleted_at IS NULL);
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>0 THEN RAISE EXCEPTION 'cross-tenant package accepted'; END IF;
END $$;
SQL
echo 'ISOLATED_ROUTER_ASSIGNMENT_PASS'
