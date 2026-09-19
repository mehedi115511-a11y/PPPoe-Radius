import { expect, test, vi } from 'vitest';
import { createChrPeerSync } from './chr-peer-sync.js';

const publicKey = Buffer.alloc(32, 12).toString('base64');
const peer = { publicKey, tunnelIp: '10.78.0.2' };
const existing = { id: 'existing', publicKey, allowedAddress: '10.78.0.2/32', disabled: false };

function adapter(peers) {
  return {
    listPeers: vi.fn(async () => peers.map((item) => ({ ...item }))),
    addPeer: vi.fn(async () => {}),
    setPeer: vi.fn(async () => {}),
    removePeer: vi.fn(async () => {}),
  };
}

test('disable rejects successful-write acknowledgement without state readback', async () => {
  const chr = adapter([existing]);
  await expect(createChrPeerSync(chr).disable(peer)).rejects.toThrow('CHR peer readback mismatch');
  expect(chr.setPeer).toHaveBeenCalledWith('existing', { disabled: true });
});

test('revoke rejects successful-write acknowledgement if peer remains', async () => {
  const chr = adapter([existing]);
  await expect(createChrPeerSync(chr).revoke(peer)).rejects.toThrow('CHR peer readback mismatch');
  expect(chr.removePeer).toHaveBeenCalledWith('existing');
});

test('revoke rejects mismatched address before any destructive write', async () => {
  const chr = adapter([{ ...existing, allowedAddress: '10.78.0.3/32' }]);
  await expect(createChrPeerSync(chr).revoke(peer)).rejects.toThrow('CHR peer conflict');
  expect(chr.removePeer).not.toHaveBeenCalled();
});

test('disable rejects duplicate key records before any write', async () => {
  const chr = adapter([existing, { ...existing, id: 'duplicate' }]);
  await expect(createChrPeerSync(chr).disable(peer)).rejects.toThrow('CHR peer missing or conflicting');
  expect(chr.setPeer).not.toHaveBeenCalled();
});
