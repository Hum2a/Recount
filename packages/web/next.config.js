/** @type {import('next').NextConfig} */

/**
 * Build connect-src allowlist from public env (set at build/deploy time).
 * @param {string | undefined} raw
 * @returns {string[]}
 */
function originsFromPublicUrl(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const u = new URL(raw);
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
