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
    expect(tenantScope(a, '', 3)).toEqual({ sql: 'owner_user_id = $3', params: [2] });
    expect(() => tenantScope(a, '', 0)).toThrow();
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
  it('does not expose another reseller package with the same name', async () => {
    const packages = [{ id: 17, owner_user_id: 3, name: 'Shared', status: 'Active' }, { id: 18, owner_user_id: 2, name: 'Shared', status: 'Active' }];
    const db = { query: vi.fn(async (sql, params) => ({ rows: packages.filter((pkg) => pkg.owner_user_id === params[0] && pkg.id === Number(params[1]) && pkg.status === 'Active') })) };
    expect(await resolveTenantPackage(db, a, 17)).toBeNull();
    expect(await resolveTenantPackage(db, a, 18)).toMatchObject({ id: 18, owner_user_id: 2 });
    expect(db.query.mock.calls.every(([sql]) => sql.includes("status='Active'"))).toBe(true);
  });
  it('rejects legacy ownerless or disabled packages in tenant-filtered lookup', async () => {
    const packages = [{ id: 19, owner_user_id: null, status: 'Active' }, { id: 20, owner_user_id: 2, status: 'Disabled' }];
    const db = { query: vi.fn(async (_sql, [owner, id]) => ({ rows: packages.filter((pkg) => pkg.owner_user_id === owner && pkg.id === Number(id) && pkg.status === 'Active') })) };
    expect(await resolveTenantPackage(db, a, 19)).toBeNull();
    expect(await resolveTenantPackage(db, a, 20)).toBeNull();
  });
  it('blocks impersonated admin and suspended actors before lookup', async () => {
    const db = { query: vi.fn() };
    await expect(resolveTenantPackage(db, { ...admin, impersonatedBy: { id: 2 } }, 17)).rejects.toThrow();
    await expect(resolveTenantPackage(db, { ...a, status: 'Suspended' }, 17)).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
  });
  it('rejects malformed IDs before database access', async () => {
    const db = { query: vi.fn() };
    for (const id of [null, 0, -1, '01', '1 OR 1=1', {}, '9007199254740992']) expect(await resolveTenantPackage(db, a, id)).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });
});
