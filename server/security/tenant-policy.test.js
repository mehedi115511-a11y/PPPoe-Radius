import { test } from 'vitest';
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
test('malformed identifiers are denied instead of coerced', () => {
  for (const id of [0, -1, 1.5, '0', '-1', '01', '1.0', '1e0', ' 1 ', 'NaN', '9007199254740992', null, undefined, {}, true]) {
    assert.equal(canAccessOwner({ ...reseller, id }, 2), false);
    assert.equal(canAccessOwner(reseller, id), false);
  }
});
test('hierarchy refuses malformed parent and target identifiers', () => {
  const target = { id: 4, role: 'Sub-reseller', parent_user_id: 2 };
  for (const id of ['02', '2.0', '2e0', 0, -2, null, {}, true]) {
    assert.equal(canManageUser(reseller, { ...target, parent_user_id: id }), false);
    assert.equal(canManageUser(reseller, { ...target, id }), false);
  }
});
