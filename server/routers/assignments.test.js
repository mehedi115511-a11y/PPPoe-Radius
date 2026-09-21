import { describe, it, expect, vi } from 'vitest';
import { assignRouterRecord } from './assignments.js';

const actor = { id: 31, role: 'Admin', status: 'Active' };

describe('manual router assignment', () => {
  it.each([['client', 'app_clients'], ['package', 'app_packages']])('scopes %s assignment to tenant and unassigned record', async (kind, table) => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ id: 7 }] }) };
    await expect(assignRouterRecord(db, actor, '9', { kind, recordId: '7' }))
      .resolves.toEqual({ routerId: 9, kind, recordId: 7, assigned: true });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain(`UPDATE ${table} AS item`);
    expect(sql).toMatch(/item\.owner_user_id=\$3/);
    expect(sql).toMatch(/item\.router_id IS NULL/);
    expect(sql).toMatch(/r\.owner_user_id=\$3/);
    expect(sql).toMatch(/r\.deleted_at IS NULL/);
    expect(params).toEqual([9, 7, 31]);
  });
  it('rejects invalid input before querying', async () => {
    const db = { query: vi.fn() };
    for (const body of [{ kind: 'client', recordId: 7, owner: 31 }, { kind: 'session', recordId: 7 }, null]) {
      await expect(assignRouterRecord(db, actor, '9', body)).rejects.toMatchObject({ status: 422 });
    }
    expect(db.query).not.toHaveBeenCalled();
  });
  it('fails closed when no tenant-owned unmapped row was updated', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(assignRouterRecord(db, actor, '9', { kind: 'client', recordId: '7' }))
      .rejects.toMatchObject({ status: 409 });
  });
});
