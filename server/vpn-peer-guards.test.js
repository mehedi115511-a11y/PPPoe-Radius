import { expect, test } from 'vitest';
import { assertPeerAdmission } from './vpn-peer-guards.js';

const key = (byte) => Buffer.alloc(32, byte).toString('base64');
const candidate = { publicKey: key(1), tunnelIp: '10.78.0.2' };

test('rejects duplicate public keys in all states, including revoked and unknown', () => {
  for (const status of ['Pending', 'Active', 'Revoked', 'SyncError', 'enabled', 'syncing', 'unexpected', null]) {
    expect(() => assertPeerAdmission({ ...candidate, peers: [{ status, public_key: key(1), tunnel_ip: '10.78.0.3' }] })).toThrow('Duplicate WireGuard public key');
  }
});

test('rejects duplicate tunnel IPs across different keys, including revoked', () => {
  for (const status of ['Active', 'Revoked', 'SyncError']) {
    expect(() => assertPeerAdmission({ ...candidate, peers: [{ status, publicKey: key(2), tunnelIp: candidate.tunnelIp }] })).toThrow('Duplicate WireGuard tunnel address');
  }
});

test('allows distinct peers and same-record idempotent retry', () => {
  expect(assertPeerAdmission({ ...candidate, peers: [{ status: 'Revoked', public_key: key(2), tunnel_ip: '10.78.0.3' }] })).toEqual(candidate);
  expect(assertPeerAdmission({ ...candidate, peers: [{ id: 8, status: 'Active', public_key: key(1), tunnel_ip: candidate.tunnelIp }], excludeId: 8 })).toEqual(candidate);
});

test('fails closed for malformed input', () => {
  expect(() => assertPeerAdmission({ ...candidate, publicKey: 'invalid' })).toThrow('Invalid WireGuard public key');
  expect(() => assertPeerAdmission({ ...candidate, tunnelIp: '10.78.0.255' })).toThrow('Invalid tunnel address');
  expect(() => assertPeerAdmission({ ...candidate, peers: null })).toThrow(TypeError);
  expect(() => assertPeerAdmission({ ...candidate, peers: [null] })).toThrow(TypeError);
});
