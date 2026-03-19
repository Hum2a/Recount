import { STORAGE_SESSION } from "./constants.js";
import { getLocal, setLocal } from "./storage.js";

/**
 * @returns {Promise<{ access_token: string, refresh_token: string, expires_at?: number } | null>}
 */
export async function getSession() {
  return (await getLocal(STORAGE_SESSION)) ?? null;
}

/** @param {{ access_token: string, refresh_token: string, expires_at?: number }} session */
export async function saveSession(session) {
  await setLocal({ [STORAGE_SESSION]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_SESSION);
}
