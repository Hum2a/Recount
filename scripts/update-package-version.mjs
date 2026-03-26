#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , rawVersion, ...targets] = process.argv;

if (!rawVersion) {
  console.error("Usage: node scripts/update-package-version.mjs <vX.Y.Z|X.Y.Z> [package.json ...]");
  process.exit(1);
}

const normalizedVersion = rawVersion.replace(/^v/, "");
const defaultTargets = [
  "packages/api/package.json",
  "packages/api-worker/package.json",
  "packages/extension/package.json",
  "packages/shared/package.json",
  "packages/web/package.json",
];
const packageFiles = targets.length > 0 ? targets : defaultTargets;

let updated = 0;

for (const relPath of packageFiles) {
  const filePath = resolve(process.cwd(), relPath);
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content);
    if (typeof parsed.version !== "string") {
      console.log(`- skipped ${relPath} (no version field)`);
      continue;
    }

    parsed.version = normalizedVersion;
    await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    console.log(`- updated ${relPath} -> ${normalizedVersion}`);
    updated += 1;
  } catch (error) {
    console.error(`- failed ${relPath}: ${error.message}`);
    process.exitCode = 1;
  }
}

if (updated === 0 && process.exitCode !== 1) {
  console.log("- no package versions changed");
}
