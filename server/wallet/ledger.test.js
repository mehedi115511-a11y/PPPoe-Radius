import { test } from 'vitest';
import assert from 'node:assert/strict';
import { minorUnits, assertWalletAccess, validatePosting, reconcile } from './ledger.js';
const entry = (walletUserId, direction, amount) => ({ walletUserId, direction, amount });
const posting = (idempotencyKey, amount = '10.00') => ({ tenantId: 'tenant-1', operation: 'recharge', idempotencyKey, entries: [entry(1, 'debit', amount), entry(2, 'credit', amount)] });

test('money uses exact minor units and rejects floats, negative and precision loss', () => {
  assert.equal(minorUnits('0.01'), 1n);
  assert.equal(minorUnits('500'), 50000n);
  for (const invalid of [1.2, '-1.00', '1.234', '01.00', 'Infinity', '90071992547410.00']) assert.throws(() => minorUnits(invalid));
});

test('posting requires balanced, positive, immutable entries', () => {
  const checked = validatePosting(posting('request-1'));
  assert.equal(checked.entries[0].amountMinor, 1000n);
  assert.ok(Object.isFrozen(checked) && Object.isFrozen(checked.entries) && Object.isFrozen(checked.entries[0]));
  assert.throws(() => validatePosting({ ...posting('request-2'), entries: [entry(1, 'debit', '10.00'), entry(2, 'credit', '9.99')] }), /Unbalanced/);
  assert.throws(() => validatePosting({ ...posting('request-3'), entries: [entry(1, 'debit', '0'), entry(2, 'credit', '0')] }), /Zero/);
});

test('reconciliation detects retries and separates tenant accounts', () => {
  const balances = reconcile([posting('req-1'), { ...posting('req-1'), tenantId: 'tenant-2' }]);
  assert.equal(balances.get('tenant-1:1'), -1000n);
  assert.equal(balances.get('tenant-1:2'), 1000n);
  assert.equal(balances.get('tenant-2:1'), -1000n);
  assert.throws(() => reconcile([posting('req-1'), posting('req-1')]), /Duplicate/);
});

test('authorization is deny-by-default and requires explicit admin permission', () => {
  assert.equal(assertWalletAccess({ userId: 3, role: 'Reseller' }, 3), true);
  assert.throws(() => assertWalletAccess({ userId: 3, role: 'Reseller' }, 4), /denied/);
  assert.throws(() => assertWalletAccess({ userId: 1, role: 'Admin' }, 4), /denied/);
  assert.equal(assertWalletAccess({ userId: 1, role: 'Admin', permissions: ['wallet:read:any'] }, 4), true);
  assert.throws(() => assertWalletAccess({ userId: 0, role: 'Admin', permissions: ['wallet:read:any'] }, 4));
});
