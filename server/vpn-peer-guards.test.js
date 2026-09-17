import { expect, test } from 'vitest';
import { assertPeerAdmission } from './vpn-peer-guards.js';

const key = (byte) => Buffer.alloc(32, byte).toString('base64');
const candidate = { publicKey: key(1), tunnelIp: '10.78.0.2' };

test('rejects a duplicate public key on any protected peer status', () => {
  for (const status of ['pending', 'active', 'enabled', 'syncing', 'ACTIVE']) {
    expect(() => assertPeerAdmission({ ...candidate, peers: [{ status, public_key: key(1), tunnel_ip: '10.78.0.3' }] })).toThrow('Duplicate active WireGuard public key');
  }
});

test('rejects a duplicate active tunnel IP across different keys', () => {
  expect(() => assertPeerAdmission({ ...candidate, peers: [{ status: 'active', publicKey: key(2), tunnelIp: '10.78.0.2' }] })).toThrow('Duplicate active WireGuard tunnel address');
});

test('allows released peers and self-exclusion for idempotent retries', () => {
  expect(assertPeerAdmission({ ...candidate, peers: [{ status: 'revoked', public_key: key(1), tunnel_ip: '10.78.0.2' }] })).toEqual(candidate);
  expect(assertPeerAdmission({ ...candidate, peers: [{ id: 8, status: 'active', public_key: key(1), tunnel_ip: '10.78.0.2' }], excludeId: 8 })).toEqual(candidate);
});

test('fails closed for malformed input', () => {
  expect(() => assertPeerAdmission({ ...candidate, publicKey: 'invalid' })).toThrow('Invalid WireGuard public key');
  expect(() => assertPeerAdmission({ ...candidate, tunnelIp: '10.78.0.255' })).toThrow('Invalid tunnel address');
  expect(() => assertPeerAdmission({ ...candidate, peers: null })).toThrow(TypeError);
  expect(() => assertPeerAdmission({ ...candidate, peers: [null] })).toThrow(TypeError);
});
