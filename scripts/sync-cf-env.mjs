import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

/** Strip CR and trim; avoids CRLF/.env quirks breaking Wrangler’s multipart upload. */
function normalizeSecretValue(value) {
  return String(value).replace(/\r/g, "").trim();
}

/**
 * Bulk upload reads secrets from a JSON file (no stdin), so `shell: true` on Windows is safe here.
 * Spawning `npx.cmd` with `shell: false` often throws EINVAL; `npx` + shell matches deploy-cf.mjs.
 * See: wrangler versions secret bulk — JSON {"KEY": "value", ...}
 */
function runVersionsSecretBulk({ configPath, secretsJsonPath }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      ["wrangler", "versions", "secret", "bulk", secretsJsonPath, "--config", configPath],
      { stdio: "inherit", shell: process.platform === "win32" }
    );
    child.on("error", (err) => rejectPromise(err));
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`wrangler versions secret bulk failed (${code ?? "unknown"})`));
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
    "STRIPE_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "FROM_EMAIL",
    "WEB_URL",
    "ALLOWED_ORIGINS",
    "DIGEST_JOB_SECRET",
    "LOGIN_AUDIT_SALT",
  ];

  const webKeys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_API_URL"];

  function buildSecretsObject(keys, localEnv) {
    const out = {};
    for (const key of keys) {
      const raw = pickEnv(localEnv, key);
      if (!raw) continue;
      const normalized = normalizeSecretValue(raw);
      if (!normalized) continue;
      out[key] = normalized;
    }
    return out;
  }

  console.log("Syncing API worker secrets (packages/api/.env + process.env) ...");
  const apiSecrets = buildSecretsObject(apiKeys, apiEnv);
  if (Object.keys(apiSecrets).length > 0) {
    const secretsPath = join(tmpdir(), `recount-cf-api-secrets-${process.pid}-${Date.now()}.json`);
    try {
      writeFileSync(secretsPath, JSON.stringify(apiSecrets), "utf8");
      await runVersionsSecretBulk({ configPath: apiWorkerConfig, secretsJsonPath: secretsPath });
    } finally {
      try {
        unlinkSync(secretsPath);
      } catch {
        /* ignore */
      }
    }
  } else {
    console.log("(No API worker secrets found to sync; skipping.)");
  }

  console.log("Syncing web worker secrets (packages/web/.env.local + process.env) ...");
  const webSecrets = buildSecretsObject(webKeys, webEnv);
  if (Object.keys(webSecrets).length > 0) {
    const secretsPath = join(tmpdir(), `recount-cf-web-secrets-${process.pid}-${Date.now()}.json`);
    try {
      writeFileSync(secretsPath, JSON.stringify(webSecrets), "utf8");
      await runVersionsSecretBulk({ configPath: webWorkerConfig, secretsJsonPath: secretsPath });
    } finally {
      try {
        unlinkSync(secretsPath);
      } catch {
        /* ignore */
      }
    }
  } else {
    console.log("(No web worker secrets found to sync; skipping.)");
  }

  console.log("Cloudflare secret sync complete.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
