import { getApiBaseUrl } from "./api-url";

export async function apiFetch(path: string, accessToken: string, init: RequestInit = {}) {
  const base = getApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const url = `${base}${path}`;
  try {
    return await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (e) {
    const hint =
      "Cannot reach the Recount API. From the repo root run `npm run dev:api` (default http://localhost:3001), or set NEXT_PUBLIC_API_URL in packages/web/.env.local to match your API.";
    throw new Error(`${hint} Request: ${url}`, { cause: e });
  }
}
