/**
 * Normalize and validate an API/Web base URL from options.
 * Allowed:
 * - https origins
 * - localhost/http(s) for local development only
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeAllowedBaseUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    return null;
  }
  const isHttps = parsed.protocol === "https:";
  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (!isHttps && !isLocalhost) {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  return parsed.origin;
}
