import { validateWireGuardPublicKey } from './vpn-address.js';

/** Pure preflight only. The database enforces global UNIQUE(public_key, tunnel_ip),
 * including revoked records; do not promise key/IP reuse before an explicit
 * coordinated storage lifecycle and router read-back are implemented. */
export function assertPeerAdmission({ publicKey, tunnelIp, peers = [], excludeId = null }) {
  if (!validateWireGuardPublicKey(publicKey)) throw new Error('Invalid WireGuard public key');
  if (typeof tunnelIp !== 'string' || !/^10\.78\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(tunnelIp)) {
    throw new Error('Invalid tunnel address');
  }
  if (!Array.isArray(peers)) throw new TypeError('peers must be an array');
  for (const peer of peers) {
    if (!peer || typeof peer !== 'object') throw new TypeError('Invalid peer record');
    if (excludeId != null && peer.id === excludeId) continue;
    if (peer.publicKey === publicKey || peer.public_key === publicKey) {
      throw new Error('Duplicate WireGuard public key');
    }
    if (peer.tunnelIp === tunnelIp || peer.tunnel_ip === tunnelIp) {
      throw new Error('Duplicate WireGuard tunnel address');
    }
  }
  return { publicKey, tunnelIp };
}
