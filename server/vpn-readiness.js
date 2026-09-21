import { validateWireGuardPublicKey } from "./vpn-address.js";

export function vpnReadiness(env = process.env) {
  const endpoint = String(env.VPN_PUBLIC_ENDPOINT || "").trim();
  const wireguardKey = validateWireGuardPublicKey(env.VPN_WIREGUARD_PUBLIC_KEY);
  const port = Number(env.VPN_WIREGUARD_PORT || 13231);
  const ipsec = /^[A-Za-z0-9_-]{12,128}$/.test(String(env.VPN_L2TP_IPSEC_SECRET || ""));
  const chrUrl = String(env.CENTRAL_VPN_ROUTER_REST_URL || env.CHR_ROUTEROS_REST_URL || "");
  let chrHttps = false;
  try { chrHttps = new URL(chrUrl).protocol === "https:"; } catch {}
  const chrMissing = [
    ...(!chrHttps ? ["CENTRAL_VPN_ROUTER_REST_URL (HTTPS)"] : []),
    ...(!(env.CENTRAL_VPN_ROUTER_USERNAME||env.CHR_ROUTEROS_USERNAME) ? ["CENTRAL_VPN_ROUTER_USERNAME"] : []),
    ...(!(env.CENTRAL_VPN_ROUTER_PASSWORD||env.CHR_ROUTEROS_PASSWORD) ? ["CENTRAL_VPN_ROUTER_PASSWORD"] : []),
    ...(!(env.CENTRAL_VPN_WIREGUARD_INTERFACE||env.CHR_WIREGUARD_INTERFACE) ? ["CENTRAL_VPN_WIREGUARD_INTERFACE"] : []),
  ];
  return {
    routerOs6: { ready: Boolean(endpoint && ipsec), missing: [
      ...(!endpoint ? ["VPN_PUBLIC_ENDPOINT"] : []),
      ...(!ipsec ? ["VPN_L2TP_IPSEC_SECRET"] : []),
    ] },
    routerOs7: { ready: Boolean(endpoint && wireguardKey && Number.isInteger(port) && port > 0 && port <= 65535), missing: [
      ...(!endpoint ? ["VPN_PUBLIC_ENDPOINT"] : []),
      ...(!wireguardKey ? ["VPN_WIREGUARD_PUBLIC_KEY"] : []),
      ...(!(Number.isInteger(port) && port > 0 && port <= 65535) ? ["VPN_WIREGUARD_PORT"] : []),
    ] },
    sstp: { ready:Boolean(endpoint), missing: endpoint?[]:["VPN_PUBLIC_ENDPOINT"] },
    centralMikrotik: { ready: chrMissing.length === 0, missing: chrMissing },
    chrSync: { ready: chrMissing.length === 0, missing: chrMissing },
  };
}
