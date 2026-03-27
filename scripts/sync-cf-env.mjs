import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
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

function runSecretPut({ configPath, key, value }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npx", ["wrangler", "secret", "put", key, "--config", configPath], {
      stdio: ["pipe", "inherit", "inherit"],
      shell: process.platform === "win32",
    });
    child.stdin.write(String(value ?? ""));
    child.stdin.end();
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`wrangler secret put ${key} failed (${code ?? "unknown"})`));
    });
  });
}

async function main() {
  const root = process.cwd();
  const apiEnvPath = resolve(root, "packages/api/.env");
  const webEnvPath = resolve(root, "packages/web/.env.local");
  const apiWorkerConfig = resolve(root, "packages/api-worker/wrangler.toml");
  const webWorkerConfig = resolve(root, "packages/web/wrangler.toml");

  const apiEnv = parseEnvFile(apiEnvPath);
  const webEnv = parseEnvFile(webEnvPath);

  /** Prefer local files; in CI there is often no .env on disk — use process.env from the runner (e.g. GitHub Actions secrets mapped to env). */
  function pickEnv(local, key) {
    const fromFile = local[key];
    if (fromFile != null && String(fromFile).length > 0) return String(fromFile);
    const fromProc = process.env[key];
    if (fromProc != null && String(fromProc).length > 0) return String(fromProc);
    return null;
  }

  const apiKeys = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "FROM_EMAIL",
    "WEB_URL",
    "ALLOWED_ORIGINS",
    "DIGEST_JOB_SECRET",
    "LOGIN_AUDIT_SALT",
  ];

  const webKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_API_URL"];

  console.log("Syncing API worker secrets (packages/api/.env + process.env) ...");
  for (const key of apiKeys) {
    const value = pickEnv(apiEnv, key);
    if (!value) continue;
    await runSecretPut({ configPath: apiWorkerConfig, key, value });
  }

  console.log("Syncing web worker secrets (packages/web/.env.local + process.env) ...");
  for (const key of webKeys) {
    const value = pickEnv(webEnv, key);
    if (!value) continue;
    await runSecretPut({ configPath: webWorkerConfig, key, value });
  }

  console.log("Cloudflare secret sync complete.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
