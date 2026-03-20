import {
  DEFAULT_WEB_URL_LOCAL,
  DEFAULT_WEB_URL_STORE,
  STORAGE_INSTALL_META,
  STORAGE_SETTINGS,
} from "./constants.js";
import { getLocal } from "./storage.js";

/**
 * Marketing / Next.js app origin: saved Options URL, else default by install channel.
 */
export async function getResolvedWebBase() {
  const settings = await getLocal(STORAGE_SETTINGS, {});
  const trimmed = typeof settings.webUrl === "string" ? settings.webUrl.trim() : "";
  if (trimmed) return trimmed.replace(/\/$/, "");

  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const channel = meta?.channel;
  if (channel === "store") return DEFAULT_WEB_URL_STORE.replace(/\/$/, "");
  return DEFAULT_WEB_URL_LOCAL.replace(/\/$/, "");
}
