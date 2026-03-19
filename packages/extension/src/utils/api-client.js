import { DEFAULT_API_URL, STORAGE_SETTINGS } from "./constants.js";
import { getSession, saveSession, clearSession } from "./auth.js";
import { getLocal } from "./storage.js";

/**
 * @typedef {{ access_token: string, refresh_token: string, expires_at?: number }} SessionPayload
 */

async function apiBase() {
  const s = await getLocal(STORAGE_SETTINGS, {});
  return s.apiUrl || DEFAULT_API_URL;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function apiFetch(path, init = {}) {
  const base = await apiBase();
  const session = await getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  let res = await fetch(`${base}${path}`, { ...init, headers });

  if (res.status === 401 && session?.refresh_token) {
    const refreshed = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (refreshed.ok) {
      const body = await refreshed.json();
      const newSession = body.data?.session;
      if (newSession?.access_token) {
        await saveSession({
          access_token: newSession.access_token,
          refresh_token: newSession.refresh_token ?? session.refresh_token,
          expires_at: newSession.expires_at,
        });
        headers.set("Authorization", `Bearer ${newSession.access_token}`);
        res = await fetch(`${base}${path}`, { ...init, headers });
      }
    } else {
      await clearSession();
    }
  }

  return res;
}
