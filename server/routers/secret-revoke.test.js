import { test, expect, vi } from 'vitest';
import { revokeRouterSecret } from './secret-revoke.js';

const actor = { id: 12, role: 'Admin', status: 'Active' };
test('revokes only owned disabled-router secret with scoped SQL', async () => {
  const db = { query: vi.fn().mockResolvedValue({ rows: [{ routerId: 4, purpose: 'router-api' }] }) };
  expect(await revokeRouterSecret(db, actor, '4', 'router-api')).toEqual({ routerId: 4, purpose: 'router-api' });
  const [sql, params] = db.query.mock.calls[0];
  expect(sql).toContain("r.status='Disabled'");
  expect(sql).toContain('r.owner_user_id=s.owner_user_id');
  expect(params).toEqual([4, 12, 'router-api']);
});
test('rejects absent secret or invalid scope without unscoped deletion', async () => {
  const db = { query: vi.fn().mockResolvedValue({ rows: [] }) };
  await expect(revokeRouterSecret(db, actor, '4', 'router-api')).rejects.toMatchObject({ status: 409 });
  await expect(revokeRouterSecret(db, { ...actor, status: 'Suspended' }, '4', 'router-api')).rejects.toMatchObject({ status: 403 });
  await expect(revokeRouterSecret(db, actor, '4', 'invalid')).rejects.toMatchObject({ status: 422 });
  expect(db.query).toHaveBeenCalledTimes(1);
});
