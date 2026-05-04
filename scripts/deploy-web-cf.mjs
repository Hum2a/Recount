import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseEnvFile } from "./parse-dotenv.mjs";

/**
 * Web deploy runs `@recount/web` `deploy`, which sets WRANGLER_BUILD_* (via cross-env)
 * so package exports resolve like Node — same as CI (.github/workflows/deploy-cloudflare.yml).
 *
 * NEXT_PUBLIC_* are inlined at `next build` time. `.env.local` overrides `.env.production`
 * when Next reads files — so we inject `packages/web/.env.production` and optional
 * `.env.deploy` into the child process env first (Next keeps existing process.env).
 */

const root = process.cwd();
const prodPath = resolve(root, "packages/web/.env.production");
const deployPath = resolve(root, "packages/web/.env.deploy");

const fromProd = parseEnvFile(prodPath);
const fromDeploy = parseEnvFile(deployPath);
const buildEnv = {
  ...process.env,
  ...fromProd,
  ...fromDeploy,
  NODE_ENV: "production",
};

const hasPublicApi =
  !!(fromDeploy.NEXT_PUBLIC_API_URL || fromProd.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL);
if (!hasPublicApi) {
  console.warn(
    "\nWarning: No NEXT_PUBLIC_API_URL in packages/web/.env.production, packages/web/.env.deploy, or the environment.\n" +
      "If packages/web/.env.local contains http://localhost:3001, that value will be baked into the production bundle.\n" +
      "Add production NEXT_PUBLIC_* to .env.production (see .env.production.example), then redeploy.\n"
  );
}

function run(command, args, opts = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: buildEnv,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
  });
}

run("npm", ["run", "deploy", "-w", "@recount/web"]).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
