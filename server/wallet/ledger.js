'use strict';

const MAX_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);

function minorUnits(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) throw new TypeError('Amount must be a nonnegative decimal string with at most two places');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > MAX_MINOR_UNITS) throw new RangeError('Amount exceeds safe minor-unit range');
  return result;
}

function requireIdentity(value, label) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value)) throw new TypeError(`Invalid ${label}`);
  return value;
}

function assertWalletAccess(actor, ownerUserId) {
  if (!actor || !Number.isSafeInteger(actor.userId) || actor.userId <= 0 || !Number.isSafeInteger(ownerUserId) || ownerUserId <= 0) throw new TypeError('Valid actor and owner identity required');
  if (actor.role === 'Admin' && actor.permissions?.includes('wallet:read:any')) return true;
  if (actor.userId !== ownerUserId) throw new Error('Wallet access denied');
  return true;
}

function validatePosting({ tenantId, operation, idempotencyKey, entries }) {
  requireIdentity(tenantId, 'tenantId');
  requireIdentity(operation, 'operation');
  requireIdentity(idempotencyKey, 'idempotencyKey');
  if (!Array.isArray(entries) || entries.length < 2) throw new TypeError('At least two ledger entries required');
  let total = 0n;
  const validated = entries.map((entry) => {
    if (!entry || !Number.isSafeInteger(entry.walletUserId) || entry.walletUserId <= 0 || !['debit', 'credit'].includes(entry.direction)) throw new TypeError('Invalid ledger entry');
    const amount = minorUnits(entry.amount);
    if (amount === 0n) throw new RangeError('Zero-value ledger entry forbidden');
    total += entry.direction === 'credit' ? amount : -amount;
    return Object.freeze({ walletUserId: entry.walletUserId, direction: entry.direction, amountMinor: amount });
  });
  if (total !== 0n) throw new Error('Unbalanced posting');
  return Object.freeze({ tenantId, operation, idempotencyKey, entries: Object.freeze(validated) });
}

function reconcile(postings) {
  if (!Array.isArray(postings)) throw new TypeError('Postings must be an array');
  const seen = new Set();
  const balances = new Map();
  for (const posting of postings) {
    const checked = validatePosting(posting);
    const key = JSON.stringify([checked.tenantId, checked.operation, checked.idempotencyKey]);
    if (seen.has(key)) throw new Error('Duplicate idempotency key');
    seen.add(key);
    for (const entry of checked.entries) {
      const walletKey = `${checked.tenantId}:${entry.walletUserId}`;
      balances.set(walletKey, (balances.get(walletKey) ?? 0n) + (entry.direction === 'credit' ? entry.amountMinor : -entry.amountMinor));
    }
  }
  return balances;
}

module.exports = { minorUnits, requireIdentity, assertWalletAccess, validatePosting, reconcile };
