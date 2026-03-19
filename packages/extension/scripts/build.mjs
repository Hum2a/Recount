import * as esbuild from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const define = {
  "process.env.API_URL": JSON.stringify(process.env.API_URL || ""),
};

mkdirSync(join(dist, "popup"), { recursive: true });
mkdirSync(join(dist, "options"), { recursive: true });
mkdirSync(join(dist, "content"), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src/background/index.js")],
  bundle: true,
  outfile: join(dist, "background.js"),
  platform: "browser",
  format: "esm",
  define,
});

await esbuild.build({
  entryPoints: [join(root, "src/popup/popup.js")],
  bundle: true,
  outfile: join(dist, "popup/popup.js"),
  platform: "browser",
  format: "esm",
  define,
});

await esbuild.build({
  entryPoints: [join(root, "src/options/options.js")],
  bundle: true,
  outfile: join(dist, "options/options.js"),
  platform: "browser",
  format: "esm",
  define,
});

cpSync(join(root, "src/popup/popup.css"), join(dist, "popup/popup.css"));
cpSync(join(root, "content/eod-nudge.js"), join(dist, "content/eod-nudge.js"));
cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
manifest.background = { service_worker: "background.js", type: "module" };
manifest.action.default_popup = "popup/index.html";
manifest.options_page = "options/index.html";
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

writeFileSync(join(dist, "popup/index.html"), readFileSync(join(root, "src/popup/index.html"), "utf8"));
writeFileSync(join(dist, "options/index.html"), readFileSync(join(root, "src/options/index.html"), "utf8"));

console.log("Built to", dist);
