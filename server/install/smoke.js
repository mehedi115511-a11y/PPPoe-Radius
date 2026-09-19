import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

export async function smokeCheck(rootDir = process.cwd(), options = {}) {
  const env = dotenv.parse(await fs.readFile(path.join(rootDir, ".env")));
  if (!env.DATABASE_URL || !env.JWT_SECRET || !env.ADMIN_USERNAME)
    throw new Error("Installation config is incomplete");
  const db = new pg.Client({ connectionString: env.DATABASE_URL });
  await db.connect();
  let migrationCount, adminCount;
  try {
    const result = await db.query(
      "select (select count(*) from app_schema_migrations)::int migrations, (select count(*) from app_users where username=$1 and role='Admin' and status='Active')::int admins",
      [env.ADMIN_USERNAME],
    );
    migrationCount = result.rows[0].migrations;
    adminCount = result.rows[0].admins;
    if (migrationCount < 1 || adminCount !== 1) throw new Error("Database migration or administrator check failed");
  } finally {
    await db.end();
  }
  const port = Number(env.API_PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("API port is invalid");
  const response = await (options.fetch || fetch)(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`API health returned HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== "ok" || body.database !== "ok") throw new Error("API health is not ready");
  return { database: "ok", migrations: migrationCount, admin: "ok", api: "ok" };
}
