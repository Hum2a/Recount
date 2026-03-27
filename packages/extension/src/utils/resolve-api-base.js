import {
  DEFAULT_API_URL_LOCAL,
  DEFAULT_API_URL_STORE,
  STORAGE_INSTALL_META,
  STORAGE_SETTINGS,
} from "./constants.js";
import { getLocal } from "./storage.js";
import { normalizeAllowedBaseUrl } from "./safe-url.js";

/**
 * Effective API base: saved Options URL, else default by install channel.
 */
export async function getResolvedApiBase() {
  const settings = await getLocal(STORAGE_SETTINGS, {});
  const fromSettings = normalizeAllowedBaseUrl(settings.apiUrl);
  if (fromSettings) return fromSettings;

  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const channel = meta?.channel;
  if (channel === "store") return DEFAULT_API_URL_STORE.replace(/\/$/, "");
  return DEFAULT_API_URL_LOCAL.replace(/\/$/, "");
}
