import { validateWireGuardPublicKey } from './vpn-address.js';

const address = (ip) => typeof ip === 'string' && /^10\.78\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(ip);

/** Adapter contract: listPeers() -> [{id, publicKey, allowedAddress, disabled}],
 * addPeer({publicKey,allowedAddress,disabled}), setPeer(id,{disabled}), removePeer(id).
 * The adapter must authenticate through configured secrets; this module never logs them.
 * Caller serializes peer operations and persists audit/state after successful verification. */
export function createChrPeerSync(adapter) {
  for (const method of ['listPeers', 'addPeer', 'setPeer', 'removePeer']) {
    if (typeof adapter?.[method] !== 'function') throw new TypeError(`CHR adapter missing ${method}`);
  }
  const list = async () => {
    const peers = await adapter.listPeers();
    if (!Array.isArray(peers)) throw new Error('CHR peer readback unavailable');
    return peers;
  };
  const match = (peers, publicKey) => peers.filter((peer) => peer.publicKey === publicKey);
  const verify = async (publicKey, expected) => {
    const found = match(await list(), publicKey);
    if (found.length !== expected.length || found.some((peer, i) => !expected[i](peer))) {
      throw new Error('CHR peer readback mismatch');
    }
    return found[0] || null;
  };
  const validate = (peer) => {
    if (!validateWireGuardPublicKey(peer?.publicKey) || !address(peer?.tunnelIp)) throw new Error('Invalid CHR peer');
    return `${peer.tunnelIp}/32`;
  };
  return {
    async enable(peer) {
      const allowedAddress = validate(peer);
      const peers = await list();
      const found = match(peers, peer.publicKey);
      if (found.length > 1 || peers.some((item) => item.publicKey !== peer.publicKey && item.allowedAddress === allowedAddress)) {
        throw new Error('CHR duplicate peer or allowed address');
      }
      if (found.length === 1 && found[0].allowedAddress !== allowedAddress) throw new Error('CHR peer address conflict');
      if (found.length === 0) {
        await adapter.addPeer({ publicKey: peer.publicKey, allowedAddress, disabled: false });
      } else if (found[0].disabled !== false) {
        await adapter.setPeer(found[0].id, { disabled: false });
      }
      return verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === false]);
    },
    async disable(peer) {
      validate(peer);
      const found = match(await list(), peer.publicKey);
      if (found.length !== 1 || found[0].allowedAddress !== `${peer.tunnelIp}/32`) throw new Error('CHR peer missing or conflicting');
      if (found[0].disabled !== true) await adapter.setPeer(found[0].id, { disabled: true });
      return verify(peer.publicKey, [(item) => item.allowedAddress === `${peer.tunnelIp}/32` && item.disabled === true]);
    },
    async revoke(peer) {
      validate(peer);
      const found = match(await list(), peer.publicKey);
      if (found.length > 1 || (found.length === 1 && found[0].allowedAddress !== `${peer.tunnelIp}/32`)) throw new Error('CHR peer conflict');
      if (found.length === 1) await adapter.removePeer(found[0].id);
      await verify(peer.publicKey, []);
      return { revoked: true };
    },
  };
}
