import { spawn } from "node:child_process";
import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL;
const port = Number(process.env.TEST_API_PORT || 39421);
if (!databaseUrl || !new URL(databaseUrl).pathname.includes("pppoe_task24_api_")) {
  throw new Error("Refusing to run without an isolated pppoe_task24_api_ database");
}
const base = `http://127.0.0.1:${port}`;
const pool = new Pool({ connectionString: databaseUrl });
const password = "Task24-Test-Password!";
const hash = await bcrypt.hash(password, 4);
let server;

const expectStatus = async (response, expected, label) => {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${label}: expected ${expected}, got ${response.status}: ${body}`);
  }
  return response.status === 204 ? null : response.json();
};
const api = (path, options = {}) =>
  fetch(base + path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
const authHeaders = (token) => ({ authorization: `Bearer ${token}` });
const login = async (username) => {
  const response = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  return (await expectStatus(response, 200, `login ${username}`)).token;
};
const waitForApi = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: "not-present", password }),
      });
      if (response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not become ready");
};

try {
  await pool.query(
    "insert into app_users(name,username,password_hash,role,status) values ($1,$2,$3,'Reseller','Active'),($4,$5,$3,'Reseller','Active')",
    ["Task24 Reseller A", "__task24_api_a__", hash, "Task24 Reseller B", "__task24_api_b__"],
  );
  server = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      API_PORT: String(port),
      JWT_SECRET: "task24-isolated-test-secret-32-characters-minimum",
      CORS_ORIGIN: "http://127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForApi();
  const tokenA = await login("__task24_api_a__");
  const tokenB = await login("__task24_api_b__");
  const packageBody = {
    name: "Shared Package",
    downloadMbps: 10,
    uploadMbps: 5,
    price: 500,
    validityDays: 30,
    status: "Active",
  };
  const packageA = (await expectStatus(await api("/api/packages", {
    method: "POST",
    headers: authHeaders(tokenA),
    body: JSON.stringify(packageBody),
  }), 201, "create package A")).data;
  const packageB = (await expectStatus(await api("/api/packages", {
    method: "POST",
    headers: authHeaders(tokenB),
    body: JSON.stringify(packageBody),
  }), 201, "create package B")).data;
  if (packageA.id === packageB.id) throw new Error("tenant package IDs collided");

  const listA = await expectStatus(await api("/api/packages", {
    headers: authHeaders(tokenA),
  }), 200, "list packages A");
  if (listA.count !== 1 || listA.data[0].id !== packageA.id) {
    throw new Error("reseller A package scope leaked");
  }
  await expectStatus(await api(`/api/packages/${packageB.id}`, {
    method: "PATCH",
    headers: authHeaders(tokenA),
    body: JSON.stringify({ ...packageBody, price: 999 }),
  }), 404, "cross-tenant package patch");
  await expectStatus(await api(`/api/packages/${packageB.id}`, {
    method: "DELETE",
    headers: authHeaders(tokenA),
  }), 404, "cross-tenant package delete");
  const clientBody = (packageId, username) => ({
    name: "Task24 Client",
    username,
    phone: "01700000000",
    package: "ignored-display-name",
    packageId,
    router: "Task24 Router",
    expiresAt: "2030-01-31",
    monthlyBill: 500,
    status: "Offline",
    password: "pppoe-test-password",
    simultaneousUse: 1,
  });
  await expectStatus(await api("/api/clients", {
    method: "POST",
    headers: authHeaders(tokenA),
    body: JSON.stringify(clientBody(packageB.id, "__task24_cross_denied__")),
  }), 422, "cross-tenant client package binding");
  const clientA = (await expectStatus(await api("/api/clients", {
    method: "POST",
    headers: authHeaders(tokenA),
    body: JSON.stringify(clientBody(packageA.id, "__task24_client_a__")),
  }), 201, "create client A")).data;
  const clientB = (await expectStatus(await api("/api/clients", {
    method: "POST",
    headers: authHeaders(tokenB),
    body: JSON.stringify(clientBody(packageB.id, "__task24_client_b__")),
  }), 201, "create client B")).data;
  await expectStatus(await api(`/api/clients/${clientB.id}`, {
    method: "DELETE",
    headers: authHeaders(tokenA),
  }), 404, "cross-tenant client delete");

  await pool.query("update app_users set status='Suspended' where username='__task24_api_b__'");
  await expectStatus(await api("/api/packages", {
    headers: authHeaders(tokenB),
  }), 401, "suspended existing token");
  console.log(`TASK24_API_INTEGRATION_PASS packages=${packageA.id},${packageB.id} clients=${clientA.id},${clientB.id}`);
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => server.once("exit", resolve));
  }
  await pool.end();
}
