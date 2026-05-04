/**
 * Base URL for the Recount REST API (`packages/api`).
 *
 * **Browser:** If the env URL points at loopback (`localhost` or `127.0.0.1`), the hostname is
 * set to `window.location.hostname` so it matches the page (e.g. both `localhost`). Otherwise
 * `fetch` goes to `127.0.0.1` while `Origin` is `http://localhost:3000` — valid CORS, but
 * easy to misconfigure in `ALLOWED_ORIGINS` and looks like a CORS bug.
 *
 * **Server (RSC, route handlers):** `localhost` is rewritten to `127.0.0.1` so Node’s fetch
 * does not hit IPv6-only `::1` while Express listens on IPv4.
 */
export function getApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");
  try {
    const u = new URL(raw);
    if (typeof window !== "undefined") {
      const pageHost = window.location.hostname;
      const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      // Dev-only: align loopback API host with the page (localhost vs 127.0.0.1). In production,
      // never rewrite — a build that still has localhost would otherwise become e.g. recount.world:3001.
      if (loopback && process.env.NODE_ENV === "development") {
        if (pageHost === "::1" || pageHost === "[::1]") {
          u.hostname = "127.0.0.1";
        } else {
          u.hostname = pageHost;
        }
      }
      return u.toString().replace(/\/+$/, "");
    }
    if (u.hostname === "localhost") u.hostname = "127.0.0.1";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return raw;
  }
}
