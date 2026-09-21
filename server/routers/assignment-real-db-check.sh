#!/usr/bin/env bash
# Executed exclusively under pg_virtualenv with disposable cluster.
set -euo pipefail
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
CREATE ROLE pppoe_app LOGIN;
CREATE TABLE app_users(id bigint PRIMARY KEY);
INSERT INTO app_users VALUES(1),(2);
CREATE TABLE app_clients(id bigint PRIMARY KEY,owner_user_id bigint REFERENCES app_users(id));
CREATE TABLE app_packages(id bigint PRIMARY KEY,owner_user_id bigint REFERENCES app_users(id));
SQL
for migration in 015_router_nas_catalog 016_router_nas_encrypted_secrets 017_router_nas_explicit_dependencies; do
  psql -v ON_ERROR_STOP=1 -q -f "server/migrations/${migration}.sql" postgres
done
psql -v ON_ERROR_STOP=1 -q postgres <<'SQL'
INSERT INTO app_routers(id,owner_user_id,name,host) VALUES (10,1,'router-a','127.0.0.1'),(20,2,'router-b','127.0.0.2');
INSERT INTO app_clients(id,owner_user_id) VALUES(1,1),(2,2),(3,NULL);
INSERT INTO app_packages(id,owner_user_id) VALUES(1,1),(2,2);
SQL
node --input-type=module <<'JS'
import pg from 'pg';
import assert from 'node:assert/strict';
import {assignRouterRecord} from './server/routers/assignments.js';
const db=new pg.Client(); await db.connect();
try {
  const owner={id:1,role:'Admin',status:'Active'};
  assert.equal((await assignRouterRecord(db,owner,'10',{kind:'client',recordId:'1'})).assigned,true);
  assert.equal((await assignRouterRecord(db,owner,'10',{kind:'package',recordId:'1'})).assigned,true);
  for(const [routerId,kind,recordId] of [['20','client','2'],['10','client','2'],['10','client','3'],['10','client','1'],['10','package','2']]){
    await assert.rejects(assignRouterRecord(db,owner,routerId,{kind,recordId}), e=>e.status===409);
  }
  assert.equal((await db.query('SELECT router_id FROM app_clients WHERE id=1')).rows[0].router_id,'10');
  console.log('REAL_FUNCTION_POSTGRES_ASSIGNMENT_PASS');
} finally {await db.end();}
JS
