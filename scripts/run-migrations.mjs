#!/usr/bin/env node
/**
 * Applies SQL files from packages/api/src/db/migrations in ascending filename order.
 *
 * Connection string (first wins):
 * - process.env.DATABASE_URL
 * - process.env.SUPABASE_DB_URL
 * - Same keys from packages/api/.env (if present)
 *
 * Supabase: Project Settings → Database → Connection string (URI). Prefer `?sslmode=require` when needed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function parseEnvFile(filePath) {
  const text = readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pickDbUrl() {
  const fromProc = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (fromProc != null && String(fromProc).trim() !== "") return String(fromProc).trim();

  const apiEnvPath = join(root, "packages/api/.env");
  if (existsSync(apiEnvPath)) {
    const env = parseEnvFile(apiEnvPath);
    const fromFile = env.DATABASE_URL ?? env.SUPABASE_DB_URL;
    if (fromFile != null && String(fromFile).trim() !== "") return String(fromFile).trim();
  }

  return null;
}

const databaseUrl = pickDbUrl();
if (!databaseUrl) {
  console.error(
    "Missing DATABASE_URL or SUPABASE_DB_URL. Set one in the environment or add it to packages/api/.env."
  );
  process.exit(1);
}

const migrationsDir = join(root, "packages/api/src/db/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`Running ${file} …`);
    await client.query(sql);
    console.log(`OK ${file}`);
  }
} finally {
  await client.end();
}

console.log(`Done (${files.length} migration file(s)).`);
