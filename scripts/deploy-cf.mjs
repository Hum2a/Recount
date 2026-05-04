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

  await run("npm", ["run", "deploy:api"]);
  await run("npm", ["run", "deploy:web"]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
