import { spawn } from "node:child_process";

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

async function main() {
  const shouldSync = process.env.SKIP_CF_ENV_SYNC !== "1";
  if (shouldSync) {
    await run("npm", ["run", "sync:cf:env"]);
  } else {
    console.log("Skipping Cloudflare env sync (SKIP_CF_ENV_SYNC=1).");
  }

  await run("npm", ["run", "deploy:api:cf"]);

  const forceWindowsWebDeploy = process.env.FORCE_WINDOWS_WEB_DEPLOY === "1";
  if (process.platform === "win32" && !forceWindowsWebDeploy) {
    console.log("");
    console.log("API worker deployed.");
    console.log("Skipping web deploy on Windows to avoid OpenNext path-resolution bug.");
    console.log("Deploy web from Linux/WSL/CI with:");
    console.log("  npm run deploy:web:cf");
    console.log("");
    console.log("To force local Windows attempt anyway:");
    console.log("  set FORCE_WINDOWS_WEB_DEPLOY=1 && npm run deploy:cf");
    return;
  }

  await run("npm", ["run", "deploy:web:cf"]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
