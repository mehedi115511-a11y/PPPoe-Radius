import { describe, it, expect, vi } from 'vitest';
import { getRouterDependencies } from './dependencies.js';

const actor = { id: 31, role: 'Admin', status: 'Active' };
describe('Router dependency privacy', () => {
  it('returns tenant-scoped counts without exposing globally unowned legacy totals', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ status: 'Disabled', clients: 1, packages: 2, unmappedClients: 3, unmappedPackages: 4, credentials: 1 }] }) };
    const result = await getRouterDependencies(db, actor, '9');
    expect(result).toMatchObject({ routerId: 9, clients: 1, packages: 2, removalAvailable: false });
    expect(result).not.toHaveProperty('unresolvedOwnerClients');
    expect(result).not.toHaveProperty('unresolvedOwnerPackages');
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).not.toMatch(/owner_user_id\s+IS\s+NULL/i);
    expect(params).toEqual([9, 31]);
  });
  it('hides routers outside the actor tenant', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(getRouterDependencies(db, actor, '9')).rejects.toMatchObject({ status: 404 });
    expect(db.query.mock.calls[0][1]).toEqual([9, 31]);
  });
});
