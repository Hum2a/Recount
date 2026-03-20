import {
  DEFAULT_API_URL_LOCAL,
  DEFAULT_API_URL_STORE,
  STORAGE_INSTALL_META,
  STORAGE_SETTINGS,
} from "./constants.js";
import { getLocal } from "./storage.js";

/**
 * Effective API base: saved Options URL, else default by install channel.
 */
export async function getResolvedApiBase() {
  const settings = await getLocal(STORAGE_SETTINGS, {});
  const trimmed = typeof settings.apiUrl === "string" ? settings.apiUrl.trim() : "";
  if (trimmed) return trimmed.replace(/\/$/, "");

  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const channel = meta?.channel;
  if (channel === "store") return DEFAULT_API_URL_STORE.replace(/\/$/, "");
  return DEFAULT_API_URL_LOCAL.replace(/\/$/, "");
}
