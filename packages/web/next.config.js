/** @type {import('next').NextConfig} */

const fs = require("fs");
const path = require("path");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value.replace(/\r/g, "").trim();
  }
  return out;
}

/**
 * Next loads `.env.local` before this config file, which often leaves `NEXT_PUBLIC_*` on localhost
 * for production builds. After that merge, override from `.env.production` then `.env.deploy`
 * (deploy wins). Only during production builds so `next dev` is unchanged.
 */
const webRoot = __dirname;
/** `next build` may load this config before NODE_ENV is set; argv is reliable. */
const mergeProdPublicEnv =
  process.env.NODE_ENV === "production" || (Array.isArray(process.argv) && process.argv.includes("build"));
if (mergeProdPublicEnv) {
  const merged = {
    ...parseEnvFile(path.join(webRoot, ".env.production")),
    ...parseEnvFile(path.join(webRoot, ".env.deploy")),
  };
  for (const [key, value] of Object.entries(merged)) {
    if (key.startsWith("NEXT_PUBLIC_") && value) {
      process.env[key] = value;
    }
  }
}

/** Same rules as `src/lib/api-url.ts` — env may omit `https://`. */
function ensureAbsoluteUrlForCsp(s) {
  const t = String(s).trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/i.test(t)) return `http://${t}`;
  return `https://${t}`;
}

/**
 * Build connect-src allowlist from public env (set at build/deploy time).
 * @param {string | undefined} raw
 * @returns {string[]}
 */
function originsFromPublicUrl(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const u = new URL(ensureAbsoluteUrlForCsp(raw));
    const list = [u.origin];
    if (u.protocol === "https:") {
      list.push(`wss://${u.host}`);
    }
    // Client fetch uses 127.0.0.1 when the configured host is localhost (see getApiBaseUrl).
    if (u.hostname === "localhost") {
      const v4 = new URL(u.href);
      v4.hostname = "127.0.0.1";
      list.push(v4.origin);
    }
    return list;
  } catch {
    return [];
  }
}

function contentSecurityPolicy() {
  const dev = process.env.NODE_ENV !== "production";
  const connectParts = new Set([
    "'self'",
    ...originsFromPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ...originsFromPublicUrl(process.env.NEXT_PUBLIC_API_URL),
    // GPU/driver browser extensions sometimes issue requests to data: URLs from the page context.
    "data:",
  ]);
  const connectSrc = Array.from(connectParts).join(" ");
  // Cloudflare Web Analytics / Insights loads beacon from static.cloudflareinsights.com
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://static.cloudflareinsights.com",
    ...(dev ? ["'unsafe-eval'"] : []),
  ].join(" ");
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");
}

const nextConfig = {
  reactStrictMode: true,
  /** Avoid PackFileCacheStrategy ENOENT renames on Windows (often breaks manifests → spurious `/_document`). */
  webpack: (config, { dev }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
