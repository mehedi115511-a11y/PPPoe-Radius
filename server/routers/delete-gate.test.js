import { describe, expect, it, vi } from 'vitest';
import { deleteRouter } from './catalog.js';
const actor = { id: 31, role: 'Admin', status: 'Active' };
describe('fail-closed router removal', () => {
  it('refuses an owned router with a non-sensitive 409 and zero mutations', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [{ id: 9 }] }) };
    await expect(deleteRouter(db, actor, '9')).rejects.toMatchObject({ status: 409 });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][0]).toMatch(/^SELECT/);
    expect(db.query.mock.calls[0][1]).toEqual([9, 31]);
  });
  it('cannot disclose existence of another tenant router', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    await expect(deleteRouter(db, actor, '9')).rejects.toMatchObject({ status: 404 });
    expect(db.query).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid ids before reaching the database', async () => {
    const db = { query: vi.fn() };
    await expect(deleteRouter(db, actor, 'not-an-id')).rejects.toMatchObject({ status: 422 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
