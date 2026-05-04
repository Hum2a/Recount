import { spawn } from "node:child_process";

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  if (process.platform !== "win32") {
    console.log("Not running on Windows; use `npm run deploy:web` directly.");
    return;
  }

  try {
    await run("wsl", ["-l", "-q"]);
  } catch {
    console.error("WSL is not installed or not available on PATH.");
    console.error("Install WSL and a distro, then rerun `npm run deploy:web:cf:wsl`.");
    process.exit(1);
  }

  // Run from /mnt/c/... path in default distro. We invoke npm from the repo root.
  const winPath = process.cwd().replace(/\\/g, "/");
  const lowerDrive = winPath[0].toLowerCase();
  const linuxPath = `/mnt/${lowerDrive}${winPath.slice(2)}`;
  const cmd = `cd "${linuxPath}" && npm run deploy:web`;

  await run("wsl", ["bash", "-lc", cmd]);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
