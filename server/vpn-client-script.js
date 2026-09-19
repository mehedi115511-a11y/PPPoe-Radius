import { validateWireGuardPublicKey } from "./vpn-address.js";
const safeName=(value)=>{
  const name=String(value||"").trim().replace(/[^A-Za-z0-9_-]/g,"-").slice(0,40);
  if (!name) throw new Error("Invalid VPN interface name");
  return name;
};
const endpoint=(value)=>{
  const text=String(value||"").trim();
  if (!/^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?|(?:\d{1,3}\.){3}\d{1,3})$/.test(text))
    throw new Error("Invalid CHR endpoint");
  return text;
};
export function renderMikroTikVpnClientScript(input) {
  if (!validateWireGuardPublicKey(input.privateKey) || !validateWireGuardPublicKey(input.serverPublicKey))
    throw new Error("Invalid WireGuard key");
  if (!/^10\.78\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(input.tunnelIp))
    throw new Error("Invalid tunnel address");
  const port=Number(input.endpointPort);
  if (!Number.isSafeInteger(port)||port<1||port>65535) throw new Error("Invalid endpoint port");
  const name=safeName(input.interfaceName || `ng-vpn-${input.peerId}`);
  const host=endpoint(input.endpointAddress);
  const marker=`NextGan-VPN-${input.peerId}`;
  return `# NextGan WiFi one-paste WireGuard client setup (RouterOS 7)
:local ngIf "${name}"
:local ngMark "${marker}"
/interface/wireguard/peers/remove [find where comment=$ngMark]
/ip/address/remove [find where comment=$ngMark]
/interface/wireguard/remove [find where name=$ngIf]
/interface/wireguard/add name=$ngIf private-key="${input.privateKey}" comment=$ngMark
/ip/address/add address=${input.tunnelIp}/32 interface=$ngIf comment=$ngMark
/interface/wireguard/peers/add interface=$ngIf public-key="${input.serverPublicKey}" endpoint-address=${host} endpoint-port=${port} allowed-address=10.78.0.0/24 persistent-keepalive=25s comment=$ngMark
:put "NextGan VPN configured: ${input.tunnelIp}"`;
}
const credential=(value,label)=>{
  const text=String(value||"");
  if(!/^[A-Za-z0-9_-]{12,128}$/.test(text)) throw new Error(`Invalid ${label}`);
  return text;
};
export function renderRouterOs6L2tpScript(input) {
  const name=safeName(input.interfaceName || `ng-vpn-${input.peerId}`);
  const host=endpoint(input.endpointAddress);
  const username=credential(input.username,"VPN username");
  const password=credential(input.password,"VPN password");
  const ipsecSecret=credential(input.ipsecSecret,"IPsec secret");
  return `# NextGan WiFi one-paste L2TP/IPsec client setup (RouterOS 6)
/interface l2tp-client/remove [find where name="${name}"]
/interface l2tp-client/add name="${name}" connect-to=${host} user="${username}" password="${password}" use-ipsec=yes ipsec-secret="${ipsecSecret}" authentication=mschap2 add-default-route=no disabled=no comment="NextGan-VPN-${input.peerId}"
:put "NextGan VPN configured for RouterOS 6"`;
}
export function renderVpnClientScript(input) {
  const major=Number(input.routerOsMajor);
  if (major===7) return renderMikroTikVpnClientScript(input);
  if (major===6) return renderRouterOs6L2tpScript(input);
  throw new Error("RouterOS version must be 6 or 7");
}
