#!/usr/bin/env node
/**
 * Walks the repository (excluding dependencies and build output) and reports
 * line counts by language: files, total lines, blank, comments (heuristic), code.
 *
 * Usage: node scripts/count-loc.mjs [--json] [--root <path>] [--out-dir <dir>] [--no-save]
 *
 * By default writes reports/loc-report.txt and reports/loc-report.json under the scan root.
 */

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, extname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".open-next",
  ".wrangler",
  ".cache",
  "out",
  ".vercel",
  "playwright-report",
  "test-results",
  ".nuxt",
  ".output",
  "__pycache__",
  ".pytest_cache",
  "target", // Rust default (if present)
]);

const SKIP_FILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);

const SKIP_EXT = new Set([".map", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".tar", ".gz"]);

const MAX_BYTES = 2 * 1024 * 1024;

/** @type {Record<string, string>} extension (lowercase, with dot) -> display category */
const EXT_TO_CATEGORY = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "SCSS",
  ".less": "Less",
  ".html": "HTML",
  ".htm": "HTML",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".json": "JSON",
  ".md": "Markdown",
  ".mdx": "Markdown",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".sql": "SQL",
  ".svg": "SVG",
  ".xml": "XML",
  ".rs": "Rust",
  ".py": "Python",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C/C++",
  ".h": "C/C++",
  ".cpp": "C/C++",
  ".hpp": "C/C++",
  ".cs": "C#",
  ".php": "PHP",
  ".rb": "Ruby",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".ps1": "PowerShell",
  ".bat": "Batch",
  ".cmd": "Batch",
  ".http": "HTTP",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".prisma": "Prisma",
  ".env": "Env",
  ".mdc": "Cursor rules",
  ".txt": "Plain text",
};

const SPECIAL_FILES = {
  dockerfile: "Docker",
  makefile: "Make",
  "makefile.macos": "Make",
  jenkinsfile: "Groovy",
  gemfile: "Ruby",
  rakefile: "Ruby",
  vagrantfile: "Ruby",
};

const COMMENT_LIKE = new Set([
  "TypeScript",
  "JavaScript",
  "CSS",
  "SCSS",
  "Less",
  "Rust",
  "Go",
  "Java",
  "Kotlin",
  "Swift",
  "C/C++",
  "C#",
  "PHP",
  "Ruby",
  "Shell",
  "PowerShell",
  "Batch",
  "GraphQL",
  "Prisma",
  "Groovy",
  "Vue",
  "Svelte",
  "SQL",
]);

function categoryForPath(fullPath) {
  const base = basename(fullPath).toLowerCase();
  if (SPECIAL_FILES[base]) return SPECIAL_FILES[base];
  if (base === "license" || base.startsWith("license.")) return "Plain text";
  if (base.startsWith(".env")) return "Env / samples";
  const ext = extname(fullPath).toLowerCase();
  if (ext && EXT_TO_CATEGORY[ext]) return EXT_TO_CATEGORY[ext];
  if (base === ".dockerignore" || base.endsWith("dockerfile")) return "Docker";
  if (base === ".gitignore" || base === ".cursorignore" || base === ".editorconfig" || base === ".nvmrc") {
    return "Project config";
  }
  if (ext === ".example" || ext === ".local") return "Env / samples";
  return ext ? `Other (${ext.slice(1) || "no-ext"})` : "Other (no extension)";
}

/**
 * Rough comment detection for C-style, # shells, YAML hash, etc.
 * @param {string} line raw line without trailing newline split
 * @param {{ inBlock: boolean, category: string }} state
 */
function lineKind(line, state) {
  const trimmed = line.trimEnd();
  if (trimmed.trim() === "") return "blank";

  const t = trimmed.trimStart();

  if (state.category === "Markdown" || state.category === "SVG" || state.category === "HTML") {
    return "code";
  }

  if (state.category === "JSON" || state.category === "TOML") {
    return "code";
  }

  if (state.category === "YAML" || state.category === "Env" || state.category === "Docker" || state.category === "Shell" || state.category === "Python" || state.category === "Ruby") {
    if (/^\s*#/.test(trimmed)) return "comment";
    return "code";
  }

  if (!COMMENT_LIKE.has(state.category)) {
    return "code";
  }

  // Block comments (C-style, CSS, TS, JS, Rust uses // and /* */ too)
  if (state.inBlock) {
    if (t.includes("*/")) state.inBlock = false;
    return "comment";
  }
  if (t.startsWith("/*")) {
    if (!t.includes("*/")) state.inBlock = true;
    return "comment";
  }
  if (t.startsWith("//") || t.startsWith("*")) return "comment";
  if (state.category === "CSS" || state.category === "SCSS" || state.category === "Less") {
    if (t.startsWith("/*") || t.endsWith("*/")) return "comment";
  }

  return "code";
}

async function* walkDir(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR_NAMES.has(e.name)) continue;
      yield* walkDir(full);
    } else {
      yield full;
    }
  }
}

function shouldSkipFile(fullPath) {
  const name = basename(fullPath);
  if (SKIP_FILE_NAMES.has(name)) return true;
  if (name.endsWith(".tsbuildinfo")) return true;
  const ext = extname(fullPath).toLowerCase();
  if (SKIP_EXT.has(ext)) return true;
  return false;
}

async function analyzeFile(fullPath, root) {
  if (shouldSkipFile(fullPath)) return null;
  let st;
  try {
    st = await stat(fullPath);
  } catch {
    return null;
  }
  if (!st.isFile() || st.size > MAX_BYTES) return null;

  const buf = await readFile(fullPath);
  if (buf.includes(0)) return null;

  const text = buf.toString("utf8");
  const category = categoryForPath(fullPath);
  const rel = relative(root, fullPath).replace(/\\/g, "/");

  const state = { inBlock: false, category };
  let blank = 0;
  let comment = 0;
  let code = 0;
  const lines = text.split(/\r?\n/);
  // Avoid counting spurious line if file ends without newline (split still ok)
  for (const line of lines) {
    const kind = lineKind(line, state);
    if (kind === "blank") blank++;
    else if (kind === "comment") comment++;
    else code++;
  }

  return {
    rel,
    category,
    ext: extname(fullPath).toLowerCase() || basename(fullPath),
    lines: lines.length,
    blank,
    comment,
    code,
  };
}

function mergeAgg(agg, row) {
  if (!agg[row.category]) {
    agg[row.category] = { files: 0, lines: 0, blank: 0, comment: 0, code: 0 };
  }
  const a = agg[row.category];
  a.files += 1;
  a.lines += row.lines;
  a.blank += row.blank;
  a.comment += row.comment;
  a.code += row.code;
}

function mergeExt(extAgg, row) {
  const key = row.ext || "(none)";
  if (!extAgg[key]) {
    extAgg[key] = { category: row.category, files: 0, lines: 0 };
  }
  extAgg[key].files += 1;
  extAgg[key].lines += row.lines;
}

/**
 * @param {{ root: string; totals: object; categories: [string, object][]; byExt: Record<string, { category: string; files: number; lines: number }>; generatedAt: string }} p
 */
function formatTextReport(p) {
  const { root, totals, categories, byExt, generatedAt } = p;
  const w = 12;
  const pad = (n, len = w) => String(n).padStart(len);
  const pct = (part, whole) => (whole === 0 ? "0.0" : ((100 * part) / whole).toFixed(1));

  const lines = [];
  const log = (s = "") => lines.push(s);

  log("");
  log(`  Lines of code — ${root}`);
  log(`  Generated: ${generatedAt}`);
  log("");
  log("  Summary");
  log("  " + "─".repeat(56));
  log(`  Files scanned (included):     ${totals.files.toLocaleString()}`);
  log(`  Total lines:                  ${totals.lines.toLocaleString()}`);
  log(`    Blank:                      ${totals.blank.toLocaleString()}  (${pct(totals.blank, totals.lines)}%)`);
  log(`    Comments (approx.):         ${totals.comment.toLocaleString()}  (${pct(totals.comment, totals.lines)}%)`);
  log(`    Code (non-blank, non-comm):   ${totals.code.toLocaleString()}  (${pct(totals.code, totals.lines)}%)`);
  log("");

  log("  By language (category)");
  log(
    "  " +
      [
        "Language".padEnd(22),
        pad("Files", 8),
        pad("Lines", 10),
        pad("Blank", 8),
        pad("Comment", 9),
        pad("Code", 10),
      ].join(" ")
  );
  log("  " + "─".repeat(72));

  for (const [name, v] of categories) {
    log(
      "  " +
        [
          name.slice(0, 21).padEnd(22),
          pad(v.files, 8),
          pad(v.lines, 10),
          pad(v.blank, 8),
          pad(v.comment, 9),
          pad(v.code, 10),
        ].join(" ")
    );
  }
  log("  " + "─".repeat(72));
  log(
    "  " +
      [
        "Total".padEnd(22),
        pad(totals.files, 8),
        pad(totals.lines, 10),
        pad(totals.blank, 8),
        pad(totals.comment, 9),
        pad(totals.code, 10),
      ].join(" ")
  );
  log("");

  const extRows = Object.entries(byExt)
    .sort((a, b) => b[1].lines - a[1].lines)
    .slice(0, 40);

  log("  By extension (top 40 by lines)");
  log("  " + ["Ext / file".padEnd(20), pad("Files", 8), pad("Lines", 10), "Category".padEnd(18)].join(" "));
  log("  " + "─".repeat(62));
  for (const [ext, v] of extRows) {
    log("  " + [String(ext).slice(0, 19).padEnd(20), pad(v.files, 8), pad(v.lines, 10), v.category.slice(0, 17).padEnd(18)].join(" "));
  }
  if (Object.keys(byExt).length > 40) {
    log(`  … ${Object.keys(byExt).length - 40} more extension buckets`);
  }
  log("");
  log("  Note: comment counts are heuristic (//, /* */, #, etc.). Lockfiles and");
  log("  binaries are excluded. JSON snapshot: loc-report.json in the same folder.");
  log("");

  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const noSave = args.includes("--no-save");
  let root = join(__dirname, "..");
  const ri = args.indexOf("--root");
  if (ri !== -1 && args[ri + 1]) root = resolve(args[ri + 1]);
  const odi = args.indexOf("--out-dir");
  const outDir = odi !== -1 && args[odi + 1] ? resolve(args[odi + 1]) : join(root, "reports");

  const rows = [];
  for await (const full of walkDir(root)) {
    const r = await analyzeFile(full, root);
    if (r) rows.push(r);
  }

  /** @type {Record<string, { files: number; lines: number; blank: number; comment: number; code: number }>} */
  const byCategory = {};
  /** @type {Record<string, { category: string; files: number; lines: number }>} */
  const byExt = {};

  for (const row of rows) {
    mergeAgg(byCategory, row);
    mergeExt(byExt, row);
  }

  const categories = Object.entries(byCategory).sort((a, b) => b[1].lines - a[1].lines);

  const totals = categories.reduce(
    (acc, [, v]) => ({
      files: acc.files + v.files,
      lines: acc.lines + v.lines,
      blank: acc.blank + v.blank,
      comment: acc.comment + v.comment,
      code: acc.code + v.code,
    }),
    { files: 0, lines: 0, blank: 0, comment: 0, code: 0 }
  );

  const generatedAt = new Date().toISOString();

  const payload = {
    generatedAt,
    root,
    totals,
    byCategory: Object.fromEntries(categories),
    byExtension: byExt,
    fileCount: rows.length,
  };

  const textBody = formatTextReport({
    root,
    totals,
    categories,
    byExt,
    generatedAt,
  });

  if (!noSave) {
    await mkdir(outDir, { recursive: true });
    const txtPath = join(outDir, "loc-report.txt");
    const jsonPath = join(outDir, "loc-report.json");
    await writeFile(txtPath, textBody.endsWith("\n") ? textBody : `${textBody}\n`, "utf8");
    await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    const relTxt = relative(root, txtPath).replace(/\\/g, "/");
    const relJson = relative(root, jsonPath).replace(/\\/g, "/");
    console.error(`Saved ${relTxt} and ${relJson}`);
  }

  if (jsonOut) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(textBody);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
