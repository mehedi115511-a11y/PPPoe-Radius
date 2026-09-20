import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('server/migrations/015_router_nas_catalog.sql', 'utf8');

describe('Router/NAS migration safety contract (static, not a database execution)', () => {
  it('scopes router records to an existing tenant owner', () => {
    expect(sql).toMatch(/owner_user_id\s+bigint\s+NOT NULL\s+REFERENCES\s+app_users\(id\)/i);
    expect(sql).toMatch(/deleted_at\s+timestamptz/i);
  });
  it('permits name reuse after soft delete but forbids active duplicate names', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS app_routers_owner_name_active_unique\s+ON app_routers\(owner_user_id,name\)\s+WHERE deleted_at IS NULL/i);
    expect(sql).not.toMatch(/UNIQUE\s*\(owner_user_id,\s*name\)/i);
  });
  it('prevents duplicate active owner endpoints', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS app_routers_owner_endpoint_unique\s+ON app_routers\(owner_user_id,host,port\)\s+WHERE deleted_at IS NULL/i);
  });
  it('does not create plaintext router passwords or shared-secret columns', () => {
    expect(sql).not.toMatch(/^\s*(?:password|shared_secret|api_password|radius_secret)\s+/im);
  });
});
