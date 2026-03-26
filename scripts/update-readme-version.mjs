#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , rawVersion, repoSlugArg] = process.argv;

if (!rawVersion) {
  console.error("Usage: node scripts/update-readme-version.mjs <vX.Y.Z|X.Y.Z> [owner/repo]");
  process.exit(1);
}

const readmePath = resolve(process.cwd(), "README.md");
const versionTag = rawVersion.startsWith("v") ? rawVersion : `v${rawVersion}`;
const repoSlug = repoSlugArg && repoSlugArg !== "unknown/unknown" ? repoSlugArg : null;
const badgeTarget = repoSlug
  ? `https://github.com/${repoSlug}/releases/tag/${versionTag}`
  : "#";
const badgeLine = `[![Release](https://img.shields.io/badge/release-${versionTag}-brightgreen.svg?style=for-the-badge)](${badgeTarget})`;

try {
  const content = await readFile(readmePath, "utf8");
  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (headingIndex === -1) {
    throw new Error("README.md has no top-level heading");
  }

  const existingBadgeIndex = lines.findIndex((line) =>
    /^\[!\[Release\]\(https:\/\/img\.shields\.io\/badge\/release-v[0-9]+\.[0-9]+\.[0-9]+/.test(line)
  );

  if (existingBadgeIndex !== -1) {
    lines[existingBadgeIndex] = badgeLine;
  } else {
    const insertAt = headingIndex + 1;
    lines.splice(insertAt, 0, "", badgeLine);
  }

  await writeFile(readmePath, `${lines.join("\n").replace(/\n+$/, "\n")}`, "utf8");
  console.log(`- updated README release badge -> ${versionTag}`);
} catch (error) {
  console.error(`- failed README update: ${error.message}`);
  process.exit(1);
}
