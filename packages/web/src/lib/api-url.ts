/**
 * Base URL for the Recount REST API (`packages/api`).
 *
 * In **server** contexts (RSC, route handlers), `http://localhost:…` is rewritten to
 * `http://127.0.0.1:…`. Node’s `fetch` (undici) often resolves `localhost` to IPv6 while
 * Express listens on IPv4, which surfaces as a generic `fetch failed` on the dashboard.
 *
 * In the **browser**, the configured URL is left unchanged.
 */
export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  if (typeof window !== "undefined") return raw;
  try {
    const u = new URL(raw);
    if (u.hostname === "localhost") u.hostname = "127.0.0.1";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}
