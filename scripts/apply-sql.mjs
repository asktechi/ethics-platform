import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const version = process.argv[2];
const file = process.argv[3];
if (!version || !file) {
  console.error("Usage: node scripts/apply-sql.mjs <version> <sql-file>");
  process.exit(1);
}

function poolerUrl(direct) {
  try {
    const parsed = new URL(direct);
    if (!parsed.hostname.startsWith("db.")) return direct;
    const ref = parsed.hostname.split(".")[1];
    parsed.hostname = "aws-0-us-east-2.pooler.supabase.com";
    parsed.port = "5432";
    parsed.username = `postgres.${ref}`;
    return parsed.toString();
  } catch {
    return direct;
  }
}

const sql = readFileSync(file, "utf8");
const connectionString = poolerUrl(process.env.SUPABASE_DB_URL ?? "");
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query(
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (
       version text primary key,
       name text,
       statements text[]
     );`,
  );
  await client.query(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ($1, $2)
     on conflict (version) do update set name = excluded.name`,
    [version, file.split("/").pop()?.replace(/\.sql$/, "") ?? version],
  );
  await client.query("commit");
  console.log("applied", version);
} catch (error) {
  await client.query("rollback");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  await client.end();
}
