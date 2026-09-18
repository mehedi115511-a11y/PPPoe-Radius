import { validateWireGuardPublicKey } from './vpn-address.js';

const address = (ip) => typeof ip === 'string' && /^10\.78\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(ip);

/** Adapter contract: listPeers() -> [{id, publicKey, allowedAddress, disabled}],
 * addPeer({publicKey,allowedAddress,disabled}), setPeer(id,{disabled}), removePeer(id).
 * The adapter authenticates using configured secrets; never log credentials here.
 * Caller must serialize operations and persist audit/state only after readback. */
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
    async list() {
      return list();
    },
    async enable(peer) {
      const allowedAddress = validate(peer);
      const peers = await list();
      const found = match(peers, peer.publicKey);
      if (found.length > 1 || peers.some((item) => item.publicKey !== peer.publicKey && item.allowedAddress === allowedAddress)) {
        throw new Error('CHR duplicate peer or allowed address');
      }
      if (found.length === 1 && found[0].allowedAddress !== allowedAddress) throw new Error('CHR peer address conflict');
      let created = false;
      let previousDisabled;
      try {
        if (found.length === 0) {
          await adapter.addPeer({ publicKey: peer.publicKey, allowedAddress, disabled: false });
          created = true;
        } else if (found[0].disabled !== false) {
          previousDisabled = found[0].disabled;
          await adapter.setPeer(found[0].id, { disabled: false });
        }
        return await verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === false]);
      } catch (error) {
        // An ambiguous add failure needs reconciliation, not deletion of a foreign peer.
        try {
          if (created) {
            const candidates = match(await list(), peer.publicKey);
            if (candidates.length !== 1 || candidates[0].allowedAddress !== allowedAddress) {
              throw new Error('CHR enable compensation requires manual reconciliation');
            }
            await adapter.removePeer(candidates[0].id);
            await verify(peer.publicKey, []);
          } else if (previousDisabled !== undefined) {
            await adapter.setPeer(found[0].id, { disabled: previousDisabled });
            await verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === previousDisabled]);
          }
        } catch (compensationError) {
          throw new AggregateError([error, compensationError], 'CHR enable failed; compensation unverified');
        }
        throw error;
      }
    },
    async disable(peer) {
      const allowedAddress = validate(peer);
      const found = match(await list(), peer.publicKey);
      if (found.length !== 1 || found[0].allowedAddress !== allowedAddress) throw new Error('CHR peer missing or conflicting');
      if (found[0].disabled === true) return verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === true]);
      let changed = false;
      try {
        await adapter.setPeer(found[0].id, { disabled: true });
        changed = true;
        return await verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === true]);
      } catch (error) {
        if (changed) {
          try {
            await adapter.setPeer(found[0].id, { disabled: found[0].disabled });
            await verify(peer.publicKey, [(item) => item.allowedAddress === allowedAddress && item.disabled === found[0].disabled]);
          } catch (compensationError) {
            throw new AggregateError([error, compensationError], 'CHR disable failed; compensation unverified');
          }
        }
        throw error;
      }
    },
    async revoke(peer) {
      const allowedAddress = validate(peer);
      const found = match(await list(), peer.publicKey);
      if (found.length > 1 || (found.length === 1 && found[0].allowedAddress !== allowedAddress)) throw new Error('CHR peer conflict');
      if (found.length === 1) await adapter.removePeer(found[0].id);
      await verify(peer.publicKey, []);
      return { revoked: true };
    },
  };
}
