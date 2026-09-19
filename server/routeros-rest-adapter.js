const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const truthy = (value) => value === true || value === "true";
const text = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`RouterOS ${label} required`);
  return value.trim();
};
const retryable = (error) => error?.name === "AbortError" || error?.retryable === true;

export function createRouterOsRestAdapter(options) {
  const baseUrl = new URL(text(options?.baseUrl, "base URL"));
  if (baseUrl.protocol !== "https:" && options?.allowInsecureHttp !== true)
    throw new Error("RouterOS REST requires HTTPS");
  const username = text(options?.username, "username");
  const password = text(options?.password, "password");
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");
  const attempts = Number.isSafeInteger(options?.attempts) ? options.attempts : 3;
  const timeoutMs = Number.isSafeInteger(options?.timeoutMs) ? options.timeoutMs : 5000;
  const backoffMs = Number.isSafeInteger(options?.backoffMs) ? options.backoffMs : 100;
  if (attempts < 1 || attempts > 5 || timeoutMs < 100 || backoffMs < 0) throw new TypeError("Invalid retry configuration");
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  const request = async (path, init = {}) => {
    let last;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(new URL(path, baseUrl), {
          ...init, signal: controller.signal,
          headers: { authorization, "content-type": "application/json", accept: "application/json", ...init.headers },
        });
        if (!response.ok) {
          const error = new Error(`RouterOS REST request failed (${response.status})`);
          error.retryable = response.status === 429 || response.status >= 500;
          throw error;
        }
        if (response.status === 204) return null;
        return await response.json();
      } catch (error) {
        last = error;
        if (!retryable(error) || attempt === attempts) throw new Error("RouterOS REST operation failed", { cause: error });
        await sleep(backoffMs * 2 ** (attempt - 1));
      } finally { clearTimeout(timer); }
    }
    throw last;
  };
  const path = "rest/interface/wireguard/peers";
  return Object.freeze({
    async listPeers() {
      const rows = await request(path);
      if (!Array.isArray(rows)) throw new Error("RouterOS peer response malformed");
      return rows.map((row) => ({
        id: text(row[".id"], "peer id"),
        publicKey: text(row["public-key"], "public key"),
        allowedAddress: text(row["allowed-address"], "allowed address"),
        disabled: truthy(row.disabled),
      }));
    },
    async addPeer(peer) {
      await request(path, { method: "PUT", body: JSON.stringify({
        "interface": text(options.interfaceName, "WireGuard interface"),
        "public-key": peer.publicKey, "allowed-address": peer.allowedAddress,
        disabled: peer.disabled ? "true" : "false",
      }) });
    },
    async setPeer(id, patch) {
      await request(`${path}/${encodeURIComponent(text(id, "peer id"))}`, {
        method: "PATCH", body: JSON.stringify({ disabled: patch.disabled ? "true" : "false" }),
      });
    },
    async removePeer(id) {
      await request(`${path}/${encodeURIComponent(text(id, "peer id"))}`, { method: "DELETE" });
    },
  });
}

export function routerOsRestAdapterFromEnv(env = process.env, overrides = {}) {
  return createRouterOsRestAdapter({
    baseUrl: env.CHR_ROUTEROS_REST_URL,
    username: env.CHR_ROUTEROS_USERNAME,
    password: env.CHR_ROUTEROS_PASSWORD,
    interfaceName: env.CHR_WIREGUARD_INTERFACE,
    allowInsecureHttp: env.CHR_ROUTEROS_ALLOW_HTTP === "true",
    ...overrides,
  });
}
