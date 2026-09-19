import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { smokeCheck } from "./smoke.js";

vi.mock("pg", () => ({
  default: { Client: class {
    async connect() {}
    async query() { return { rows: [{ migrations: 6, admins: 1 }] }; }
    async end() {}
  } },
}));
let dir;
afterEach(async () => { if (dir) await fs.rm(dir, { recursive: true, force: true }); dir = null; });
describe("destination smoke check", () => {
  it("verifies installed database and local API without returning credentials", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "pppoe-smoke-"));
    await fs.writeFile(path.join(dir, ".env"), 'DATABASE_URL="postgresql://user:secret@localhost/db"\nJWT_SECRET="abcdefghijklmnopqrstuvwxyz0123456789"\nADMIN_USERNAME="admin"\nAPI_PORT="3001"\n');
    const result = await smokeCheck(dir, { fetch: async url => {
      expect(url).toBe("http://127.0.0.1:3001/api/health");
      return { ok: true, json: async () => ({ status: "ok", database: "ok" }) };
    } });
    expect(result).toEqual({ database: "ok", migrations: 6, admin: "ok", api: "ok" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
