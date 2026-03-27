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
    return list;
  } catch {
    return [];
  }
}

function contentSecurityPolicy() {
  const dev = process.env.NODE_ENV !== "production";
  const connectParts = new Set(["'self'", ...originsFromPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL), ...originsFromPublicUrl(process.env.NEXT_PUBLIC_API_URL)]);
  const connectSrc = Array.from(connectParts).join(" ");
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])].join(" ");
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
