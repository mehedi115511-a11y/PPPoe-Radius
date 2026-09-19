import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { quoteIdentifier } from "./config.js";

export const migrationFiles = names => names.filter(name => /^\d{3}_.+\.sql$/.test(name)).sort();
export const schemaWithoutIncludes = sql => sql.split(/\r?\n/).filter(line => !/^\s*\\ir\s+/i.test(line)).join("\n");
export const grantToRole = (sql, role) => sql.replace(/\bTO\s+pppoe_app\b/gi, `TO ${quoteIdentifier(role)}`);
const digest = sql => crypto.createHash("sha256").update(sql).digest("hex");

export async function runMigrations({ connectionString, rootDir }) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // Session lock covers schema initialization and the entire ordered migration set.
    await client.query("select pg_advisory_lock(778114,1)");
    const role = (await client.query("select current_user name")).rows[0].name;
    const directory = path.join(rootDir, "server/migrations");
    const migrations = await Promise.all(migrationFiles(await fs.readdir(directory)).map(async name => {
      const sql = grantToRole(await fs.readFile(path.join(directory, name), "utf8"), role);
      return { name, sql, checksum: digest(sql) };
    }));
    const marker = await client.query("select to_regclass('public.app_schema_migrations') marker");
    const applied = new Map();
    if (marker.rows[0].marker) {
      const rows = await client.query("select name,checksum from app_schema_migrations");
      for (const row of rows.rows) applied.set(row.name, row.checksum);
      for (const migration of migrations) {
        if (applied.has(migration.name) && applied.get(migration.name) !== migration.checksum)
          throw new Error(`Applied migration changed: ${migration.name}`);
      }
    }
    const schema = schemaWithoutIncludes(await fs.readFile(path.join(rootDir, "server/schema.sql"), "utf8"));
    await client.query(grantToRole(schema, role));
    await client.query("create table if not exists app_schema_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())");
    for (const migration of migrations) {
      if (applied.has(migration.name)) continue;
      await client.query(migration.sql);
      await client.query("insert into app_schema_migrations(name,checksum) values($1,$2)", [migration.name,migration.checksum]);
    }
    return (await client.query("select name,checksum from app_schema_migrations order by name")).rows;
  } finally {
    await client.end();
  }
}
