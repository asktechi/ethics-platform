import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index < 0) continue;
  process.env[trimmed.slice(0, index).trim()] ||= trimmed.slice(index + 1).trim();
}

const parsed = new URL(process.env.SUPABASE_DB_URL);
const ref = parsed.hostname.split(".")[1];
parsed.hostname = "aws-0-us-east-2.pooler.supabase.com";
parsed.port = "5432";
parsed.username = `postgres.${ref}`;

const client = new pg.Client({
  connectionString: parsed.toString(),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query("notify pgrst, 'reload schema'");
const count = await client.query(
  `select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
);
console.log(JSON.stringify({ reloaded: true, public_tables: count.rows[0].n }));
await client.end();
