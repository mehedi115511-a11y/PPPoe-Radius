import { validateWireGuardPublicKey } from "./vpn-address.js";

export function vpnReadiness(env = process.env) {
  const endpoint = String(env.VPN_PUBLIC_ENDPOINT || "").trim();
  const wireguardKey = validateWireGuardPublicKey(env.VPN_WIREGUARD_PUBLIC_KEY);
  const port = Number(env.VPN_WIREGUARD_PORT || 13231);
  const ipsec = /^[A-Za-z0-9_-]{12,128}$/.test(String(env.VPN_L2TP_IPSEC_SECRET || ""));
  const chrUrl = String(env.CHR_ROUTEROS_REST_URL || "");
  let chrHttps = false;
  try { chrHttps = new URL(chrUrl).protocol === "https:"; } catch {}
  const chrMissing = [
    ...(!chrHttps ? ["CHR_ROUTEROS_REST_URL (HTTPS)"] : []),
    ...(!env.CHR_ROUTEROS_USERNAME ? ["CHR_ROUTEROS_USERNAME"] : []),
    ...(!env.CHR_ROUTEROS_PASSWORD ? ["CHR_ROUTEROS_PASSWORD"] : []),
    ...(!env.CHR_WIREGUARD_INTERFACE ? ["CHR_WIREGUARD_INTERFACE"] : []),
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
    chrSync: { ready: chrMissing.length === 0, missing: chrMissing },
  };
}
