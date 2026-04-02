import { WEB_APP_ORIGIN, STORAGE_SETTINGS } from "./constants.js";
import { getLocal } from "./storage.js";
import { normalizeAllowedBaseUrl } from "./safe-url.js";

/**
 * Marketing / Next.js app origin: saved Options URL, else {@link WEB_APP_ORIGIN}.
 */
export async function getResolvedWebBase() {
  const settings = await getLocal(STORAGE_SETTINGS, {});
  const fromSettings = normalizeAllowedBaseUrl(settings.webUrl);
  if (fromSettings) return fromSettings;
  return WEB_APP_ORIGIN.replace(/\/$/, "");
}
