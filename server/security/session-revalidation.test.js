import { describe, expect, it, vi } from 'vitest';
import { revalidateSession } from './session-revalidation.js';
const reseller = { id: 2, name: 'Reseller', username: 'reseller', role: 'Reseller', status: 'Active' };
const admin = { id: 1, name: 'Admin', username: 'admin', role: 'Admin', status: 'Active' };
const db = (...users) => ({ query: vi.fn().mockImplementation(async (_sql, [id]) => ({ rows: users.filter((u) => u.id === Number(id)) })) });
describe('database-backed JWT session revalidation', () => {
  it('accepts current role and status, but not stale or deleted claims', async () => {
    expect(await revalidateSession(db(reseller), reseller)).toMatchObject(reseller);
    await expect(revalidateSession(db({ ...reseller, status: 'Suspended' }), reseller)).rejects.toThrow();
    await expect(revalidateSession(db(), reseller)).rejects.toThrow();
    await expect(revalidateSession(db({ ...reseller, role: 'Sub-reseller' }), reseller)).rejects.toThrow();
    await expect(revalidateSession(db({ ...reseller, username: 'renamed' }), reseller)).rejects.toThrow();
    await expect(revalidateSession(db(reseller), { ...reseller, id: '2 OR 1=1' })).rejects.toThrow();
  });
  it('rejects impersonation when administrator loses privileges', async () => {
    const claims = { ...reseller, impersonatedBy: { id: 1, username: 'admin', name: 'Admin' } };
    expect(await revalidateSession(db(reseller, admin), claims)).toMatchObject({ id: 2, impersonatedBy: { id: 1 } });
    await expect(revalidateSession(db(reseller, { ...admin, status: 'Suspended' }), claims)).rejects.toThrow();
    await expect(revalidateSession(db(reseller, { ...admin, role: 'Reseller' }), claims)).rejects.toThrow();
    await expect(revalidateSession(db(reseller), claims)).rejects.toThrow();
    await expect(revalidateSession(db(reseller, admin), { ...claims, impersonatedBy: { id: 0 } })).rejects.toThrow();
  });
});
