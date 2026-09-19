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
  const maintenance = new pg.Client({ connectionString: databaseUrl(config, "postgres") });
  await maintenance.connect();
  try {
    const found = await maintenance.query("select 1 from pg_database where datname=$1", [config.dbName]);
    if (found.rowCount && !input.allowExistingInstall)
      throw new Error("Target database already exists; refusing to modify an unreviewed database");
    if (!found.rowCount) await maintenance.query(`create database ${quoteIdentifier(config.dbName)}`);
  } finally {
    await maintenance.end();
  }
  const db = new pg.Client({ connectionString: databaseUrl(config) });
  await db.connect();
  try {
    if (input.allowExistingInstall) {
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
    await appDb.query(
      "insert into app_users(name,username,password_hash,role,status) values($1,$2,$3,'Admin','Active') on conflict(username) do nothing",
      [config.adminName, config.adminUsername, hash],
    );
    const health = (await appDb.query("select current_database() database,current_user username")).rows[0];
    if (!existingEnv) await fs.writeFile(envPath, renderEnv(config), { flag: "wx", mode: 0o600 });
    return { ...health, appliedMigrations: migrations.length };
  } finally {
    await appDb.end();
  }
}
