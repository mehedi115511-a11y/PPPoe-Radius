import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { installApplication } from "./install.js";

const rl = createInterface({ input, output });
const ask = async (label, fallback = "") =>
  (await rl.question(`${label}${fallback ? ` [${fallback}]` : ""}: `)).trim() || fallback;
async function secret(label) {
  if (!input.isTTY || !output.isTTY) throw new Error("Interactive terminal required for secret input");
  const original = rl._writeToOutput;
  rl._writeToOutput = function (text) {
    if (text.includes(label)) output.write(text);
  };
  try { return (await rl.question(`${label}: `)).trim(); }
  finally { rl._writeToOutput = original; output.write("\n"); }
}
try {
  console.log("PPPoE/RADIUS portable installer");
  const config = {
    dbHost: await ask("Database host", "localhost"),
    dbPort: await ask("Database port", "5432"),
    dbName: await ask("Database name", "pppoe_radius"),
    dbUser: await ask("Database username", "pppoe_app"),
    dbPassword: await secret("Database password"),
    adminName: await ask("Admin display name", "System Administrator"),
    adminUsername: await ask("Admin username", "admin"),
    adminPassword: await secret("Admin password (12+ characters)"),
    apiPort: await ask("API port", "3001"),
    corsOrigin: await ask("Web origin", "http://localhost:5173"),
    vpnPublicEndpoint: await ask("VPN public hostname or IP (optional)"),
    vpnWireguardPublicKey: await ask("CHR WireGuard public key for RouterOS 7 (optional)"),
    vpnWireguardPort: await ask("CHR WireGuard port", "13231"),
    vpnL2tpIpsecSecret: await secret("L2TP/IPsec shared secret for RouterOS 6 (optional)"),
    allowExistingInstall: process.argv.includes("--rerun"),
  };
  rl.close();
  const result = await installApplication(config);
  console.log(`Install complete: database=${result.database}, migrations=${result.appliedMigrations}`);
} catch (error) {
  rl.close();
  console.error(`Install failed: ${error.message}`);
  process.exitCode = 1;
}
