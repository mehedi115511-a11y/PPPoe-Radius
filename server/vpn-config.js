import { validateWireGuardPublicKey } from "./vpn-address.js";
export function renderRouterOsPeerScript({ publicKey, tunnelIp, interfaceName = "wg-radius" }) {
 if (!validateWireGuardPublicKey(publicKey)) throw new Error("Invalid WireGuard public key");
 if (!/^10\.78\.0\.(?:[2-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-4])$/.test(tunnelIp)) throw new Error("Invalid tunnel address");
 if (!/^[a-zA-Z0-9_-]{1,40}$/.test(interfaceName)) throw new Error("Invalid interface name");
 return `/interface/wireguard/peers/add interface=${interfaceName} public-key="${publicKey}" allowed-address=${tunnelIp}/32 persistent-keepalive=25s`;
}
