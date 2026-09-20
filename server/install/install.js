import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import pg from "pg";
import { databaseUrl, quoteIdentifier, renderEnv, validateInstallConfig } from "./config.js";
import { runMigrations } from "./migrate.js";

export async function installApplication(input, rootDir = process.cwd()) {
  const config = validateInstallConfig(input);
  const envPath = path.join(rootDir, ".env");
  const existingEnv = await fs.readFile(envPath, "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existingEnv && !input.allowExistingInstall)
    throw new Error("An installation already exists in this directory; use explicit re-run mode");
  let db = new pg.Client({ connectionString: databaseUrl(config) });
  try {
    await db.connect();
  } catch (error) {
    if (error.code !== "3D000" || input.allowExistingInstall) throw error;
    const maintenance = new pg.Client({ connectionString: databaseUrl(config, "postgres") });
    await maintenance.connect();
    try {
      await maintenance.query(`create database ${quoteIdentifier(config.dbName)}`);
    } finally {
      await maintenance.end();
    }
    db = new pg.Client({ connectionString: databaseUrl(config) });
    await db.connect();
  }
  try {
    if (!input.allowExistingInstall) {
      const tables = await db.query(
        "select count(*)::int count from pg_tables where schemaname not in ('pg_catalog','information_schema')",
      );
      if (tables.rows[0].count !== 0)
        throw new Error("Target database contains tables; refusing to modify an unreviewed database");
    } else {
      if (!existingEnv) throw new Error("Re-run requires an existing local .env");
      const expected = `DATABASE_URL=${JSON.stringify(databaseUrl(config))}`;
      if (!existingEnv.split(/\r?\n/).includes(expected))
        throw new Error("Re-run database does not match the existing installation");
      const marker = await db.query("select to_regclass('public.app_schema_migrations') marker");
      if (!marker.rows[0].marker) throw new Error("Target has no installer migration marker");
      const jwtLine = existingEnv.split(/\r?\n/).find(line => line.startsWith("JWT_SECRET="));
      if (!jwtLine) throw new Error("Existing installation has no JWT secret");
      config.jwtSecret = JSON.parse(jwtLine.slice("JWT_SECRET=".length));
    }
  } finally {
    await db.end();
  }
  const migrations = await runMigrations({ connectionString: databaseUrl(config), rootDir });
  const appDb = new pg.Client({ connectionString: databaseUrl(config) });
  await appDb.connect();
  try {
    const hash = await bcrypt.hash(config.adminPassword, 12);
    await appDb.query("BEGIN");
    try {
      await appDb.query(
        "insert into app_users(name,username,password_hash,role,status) values($1,$2,$3,'Admin','Active') on conflict(username) do nothing",
        [config.adminName, config.adminUsername, hash],
      );
      const admin = await appDb.query(
        "select id from app_users where username=$1 and role='Admin'",
        [config.adminUsername],
      );
      if (!admin.rows[0]) throw new Error("Installer admin username belongs to a different role");
      await appDb.query(
        "insert into wallet_accounts(tenant_owner_user_id,owner_user_id) values($1,$1) on conflict(tenant_owner_user_id,owner_user_id,currency) do nothing",
        [admin.rows[0].id],
      );
      await appDb.query("COMMIT");
    } catch (error) {
      await appDb.query("ROLLBACK");
      throw error;
    }
    const health = (await appDb.query("select current_database() database,current_user username")).rows[0];
    if (!existingEnv) await fs.writeFile(envPath, renderEnv(config), { flag: "wx", mode: 0o600 });
    return { ...health, appliedMigrations: migrations.length };
  } finally {
    await appDb.end();
  }
}
