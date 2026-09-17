import { expect, test, vi } from 'vitest';
import { createChrPeerSync } from './chr-peer-sync.js';

const publicKey = Buffer.alloc(32, 9).toString('base64');
const peer = { publicKey, tunnelIp: '10.78.0.2' };
function mock(initial = []) {
  let peers = structuredClone(initial);
  const adapter = {
    listPeers: vi.fn(async () => structuredClone(peers)),
    addPeer: vi.fn(async (data) => { peers.push({ id: 'peer-1', ...data }); }),
    setPeer: vi.fn(async (id, patch) => { peers = peers.map((item) => item.id === id ? { ...item, ...patch } : item); }),
    removePeer: vi.fn(async (id) => { peers = peers.filter((item) => item.id !== id); }),
  };
  return { adapter, peers: () => peers };
}

test('enable creates, verifies and retries idempotently', async () => {
  const { adapter } = mock();
  const sync = createChrPeerSync(adapter);
  await expect(sync.enable(peer)).resolves.toMatchObject({ allowedAddress: '10.78.0.2/32', disabled: false });
  await sync.enable(peer);
  expect(adapter.addPeer).toHaveBeenCalledTimes(1);
});

test('disable and revoke verify state and tolerate revoke retry', async () => {
  const { adapter } = mock([{ id: 'p', publicKey, allowedAddress: '10.78.0.2/32', disabled: false }]);
  const sync = createChrPeerSync(adapter);
  await expect(sync.disable(peer)).resolves.toMatchObject({ disabled: true });
  await sync.disable(peer);
  expect(adapter.setPeer).toHaveBeenCalledTimes(1);
  await expect(sync.revoke(peer)).resolves.toEqual({ revoked: true });
  await sync.revoke(peer);
  expect(adapter.removePeer).toHaveBeenCalledTimes(1);
});

test('rejects existing key/address conflicts without writes', async () => {
  const { adapter } = mock([{ id: 'other', publicKey: Buffer.alloc(32, 8).toString('base64'), allowedAddress: '10.78.0.2/32', disabled: false }]);
  await expect(createChrPeerSync(adapter).enable(peer)).rejects.toThrow('duplicate');
  expect(adapter.addPeer).not.toHaveBeenCalled();
});

test('ambiguous add readback fails closed without deleting an unverified peer', async () => {
  const { adapter } = mock();
  adapter.addPeer = vi.fn(async () => undefined);
  await expect(createChrPeerSync(adapter).enable(peer)).rejects.toThrow('compensation unverified');
  expect(adapter.removePeer).not.toHaveBeenCalled();
});

test('enable compensates a verified created peer when readback is wrong', async () => {
  const { adapter, peers } = mock();
  let reads = 0;
  const originalList = adapter.listPeers;
  adapter.listPeers = vi.fn(async () => {
    reads += 1;
    const current = await originalList();
    if (reads === 2) return current.map((item) => ({ ...item, disabled: true }));
    return current;
  });
  await expect(createChrPeerSync(adapter).enable(peer)).rejects.toThrow('readback mismatch');
  expect(adapter.removePeer).toHaveBeenCalledTimes(1);
  expect(peers()).toEqual([]);
});

test('disable compensates when CHR readback reports wrong state', async () => {
  const { adapter, peers } = mock([{ id: 'p', publicKey, allowedAddress: '10.78.0.2/32', disabled: false }]);
  let reads = 0;
  const originalList = adapter.listPeers;
  adapter.listPeers = vi.fn(async () => {
    reads += 1;
    const current = await originalList();
    return reads === 2 ? current.map((item) => ({ ...item, disabled: false })) : current;
  });
  await expect(createChrPeerSync(adapter).disable(peer)).rejects.toThrow('readback mismatch');
  expect(adapter.setPeer).toHaveBeenCalledTimes(2);
  expect(peers()[0].disabled).toBe(false);
});

test('disable reports unverified compensation if rollback fails', async () => {
  const { adapter } = mock([{ id: 'p', publicKey, allowedAddress: '10.78.0.2/32', disabled: false }]);
  adapter.listPeers = vi.fn().mockResolvedValueOnce([{ id: 'p', publicKey, allowedAddress: '10.78.0.2/32', disabled: false }]).mockResolvedValueOnce([]);
  adapter.setPeer = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('rollback failed'));
  await expect(createChrPeerSync(adapter).disable(peer)).rejects.toThrow('compensation unverified');
});

test('readback unavailable, malformed peer and missing adapter fail closed', async () => {
  expect(() => createChrPeerSync({})).toThrow('missing');
  const { adapter } = mock();
  adapter.listPeers = vi.fn(async () => null);
  await expect(createChrPeerSync(adapter).enable(peer)).rejects.toThrow('unavailable');
  await expect(createChrPeerSync(mock().adapter).enable({ ...peer, tunnelIp: '10.78.0.255' })).rejects.toThrow('Invalid');
});
