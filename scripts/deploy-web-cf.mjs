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

if (process.platform === "win32") {
  console.error(
    "Web deploy is blocked on Windows due to OpenNext middleware path-resolution bug. Use Linux/WSL/CI for `deploy:web:cf`."
  );
  process.exit(1);
}

run("npm", ["run", "deploy", "-w", "@recount/web"]).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
