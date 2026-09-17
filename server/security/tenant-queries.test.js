import { describe, expect, it, vi } from 'vitest';
import { tenantScope, resolveTenantPackage, requireReconciledOwner } from './tenant-queries.js';
const admin = { id: 1, role: 'Admin', status: 'Active' };
const a = { id: 2, role: 'Reseller', status: 'Active' };
const b = { id: 3, role: 'Reseller', status: 'Active' };
describe('fail-closed ownership', () => {
  it('rejects NULL owners even for admins', () => {
    expect(tenantScope(admin).sql).toBe('owner_user_id IS NOT NULL');
    expect(requireReconciledOwner(admin, null)).toBe(false);
    expect(requireReconciledOwner(a, null)).toBe(false);
  });
  it('isolates same-role resellers and denies stale or impersonated admin', () => {
    expect(tenantScope(a)).toEqual({ sql: 'owner_user_id = $1', params: [2] });
    expect(tenantScope(b).params).toEqual([3]);
    expect(requireReconciledOwner(a, 3)).toBe(false);
    expect(requireReconciledOwner(b, 2)).toBe(false);
    expect(() => tenantScope({ ...a, status: 'Suspended' })).toThrow();
    expect(() => tenantScope({ ...admin, impersonatedBy: { id: 2 } })).toThrow();
  });
  it('rejects malicious SQL aliases', () => {
    expect(() => tenantScope(a, 'x; DROP TABLE app_users')).toThrow();
  });
});
describe('RADIUS package identity', () => {
  it('looks up by package ID and owning tenant, never name', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    expect(await resolveTenantPackage(db, a, 17)).toBeNull();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('owner_user_id = $1 AND id=$2'), [2, 17]);
    expect(db.query.mock.calls[0][0]).not.toContain('name=');
  });
  it('rejects malformed IDs before database access', async () => {
    const db = { query: vi.fn() };
    for (const id of [null, 0, -1, '01', '1 OR 1=1', {}, '9007199254740992']) expect(await resolveTenantPackage(db, a, id)).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });
});
