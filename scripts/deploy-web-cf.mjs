import { spawn } from "node:child_process";

/**
 * Web deploy runs `@recount/web` `deploy`, which sets WRANGLER_BUILD_* (via cross-env)
 * so package exports resolve like Node — same as CI (.github/workflows/deploy-cloudflare.yml).
 */

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
  });
}

run("npm", ["run", "deploy", "-w", "@recount/web"]).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
