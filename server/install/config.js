import crypto from "node:crypto";
const required=(v,n)=>{const x=String(v||"").trim();if(!x)throw new Error(`${n} is required`);return x};
const port=(v,n)=>{const x=Number(v);if(!Number.isInteger(x)||x<1||x>65535)throw new Error(`${n} must be 1-65535`);return x};
export const quoteIdentifier=v=>`"${String(v).replaceAll('"','""')}"`;
export function validateInstallConfig(i){const c={dbHost:required(i.dbHost,"Database host"),dbPort:port(i.dbPort||5432,"Database port"),dbName:required(i.dbName,"Database name"),dbUser:required(i.dbUser,"Database user"),dbPassword:required(i.dbPassword,"Database password"),adminName:required(i.adminName||"System Administrator","Admin name"),adminUsername:required(i.adminUsername||"admin","Admin username"),adminPassword:required(i.adminPassword,"Admin password"),apiPort:port(i.apiPort||3001,"API port"),corsOrigin:required(i.corsOrigin||"http://localhost:5173","CORS origin"),jwtSecret:i.jwtSecret||crypto.randomBytes(48).toString("base64url")};if(!/^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/.test(c.dbName))throw new Error("Database name contains unsupported characters");if(!/^[A-Za-z_][A-Za-z0-9_.-]{2,62}$/.test(c.adminUsername))throw new Error("Admin username is invalid");if(c.adminPassword.length<12)throw new Error("Admin password must contain at least 12 characters");if(c.jwtSecret.length<32)throw new Error("JWT secret must contain at least 32 characters");new URL(c.corsOrigin);
c.vpnPublicEndpoint=String(i.vpnPublicEndpoint||"").trim();
c.vpnWireguardPublicKey=String(i.vpnWireguardPublicKey||"").trim();
c.vpnWireguardPort=port(i.vpnWireguardPort||13231,"WireGuard port");
c.vpnL2tpIpsecSecret=String(i.vpnL2tpIpsecSecret||"").trim();
if(c.vpnPublicEndpoint && /[\s\r\n]/.test(c.vpnPublicEndpoint))throw new Error("VPN endpoint is invalid");
if(c.vpnWireguardPublicKey && !/^[A-Za-z0-9+/]{43}=$/.test(c.vpnWireguardPublicKey))throw new Error("WireGuard public key is invalid");
if(c.vpnL2tpIpsecSecret && c.vpnL2tpIpsecSecret.length<16)throw new Error("L2TP/IPsec secret must contain at least 16 characters");
return c}
export function databaseUrl(c,d=c.dbName){const u=new URL("postgresql://localhost");u.username=c.dbUser;u.password=c.dbPassword;u.hostname=c.dbHost;u.port=String(c.dbPort);u.pathname=`/${d}`;return u.toString()}
export function renderEnv(c){return Object.entries({DATABASE_URL:databaseUrl(c),JWT_SECRET:c.jwtSecret,API_PORT:c.apiPort,CORS_ORIGIN:c.corsOrigin,ADMIN_USERNAME:c.adminUsername,VPN_PUBLIC_ENDPOINT:c.vpnPublicEndpoint,VPN_WIREGUARD_PUBLIC_KEY:c.vpnWireguardPublicKey,VPN_WIREGUARD_PORT:c.vpnWireguardPort,VPN_L2TP_IPSEC_SECRET:c.vpnL2tpIpsecSecret}).map(([k,v])=>`${k}=${JSON.stringify(String(v))}`).join("\n")+"\n"}
