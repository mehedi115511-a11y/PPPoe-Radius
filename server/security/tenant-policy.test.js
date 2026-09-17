import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOwner, canManageUser } from './tenant-policy.js';
const admin = { id: 1, role: 'Admin', status: 'Active' };
const reseller = { id: 2, role: 'Reseller', status: 'Active' };
const other = { id: 3, role: 'Reseller', status: 'Active' };
test('owner access requires active actor and correct tenant', () => {
  assert.equal(canAccessOwner(reseller, 2), true);
  assert.equal(canAccessOwner(reseller, 3), false);
  assert.equal(canAccessOwner(other, 2), false);
  assert.equal(canAccessOwner(reseller, null), false);
  assert.equal(canAccessOwner({ ...reseller, status: 'Suspended' }, 2), false);
});
test('administrator and impersonation respect boundaries', () => {
  assert.equal(canAccessOwner(admin, 3), true);
  assert.equal(canAccessOwner({ ...admin, impersonatedBy: { id: 9 } }, 3), false);
  assert.equal(canAccessOwner(null, 2), false);
});
test('sub-reseller management requires matching parent', () => {
  const sub = { id: 4, role: 'Sub-reseller', parent_user_id: 2 };
  assert.equal(canManageUser(reseller, sub), true);
  assert.equal(canManageUser(other, sub), false);
  assert.equal(canManageUser(reseller, { ...sub, role: 'Reseller' }), false);
  assert.equal(canManageUser({ ...reseller, status: 'Suspended' }, sub), false);
  assert.equal(canManageUser(admin, sub), true);
});
