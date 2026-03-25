import { getLocal, setLocal } from "./storage.js";
import { STORAGE_INSTALL_META } from "./constants.js";

/**
 * How this build was installed.
 * - **local** — Load unpacked / developer mode (Chrome, Edge, Opera, etc.).
 * - **store** — Installed via a browser extension marketplace/update URL.
 * - **other** — Enterprise, sideload, or unknown; API default matches **local** unless you set Options.
 */
export const InstallChannel = {
  LOCAL: "local",
  STORE: "store",
  OTHER: "other",
};

function channelFromManifest() {
  try {
    const manifest = chrome?.runtime?.getManifest?.();
    const updateUrl = typeof manifest?.update_url === "string" ? manifest.update_url.toLowerCase() : "";
    if (!updateUrl) return InstallChannel.LOCAL;
    if (
      updateUrl.includes("clients2.google.com/service/update2/crx") ||
      updateUrl.includes("addons.opera.com") ||
      updateUrl.includes("edge.microsoft.com")
    ) {
      return InstallChannel.STORE;
    }
    return InstallChannel.OTHER;
  } catch {
    return InstallChannel.OTHER;
  }
}

/**
 * @returns {Promise<{ channel: keyof typeof InstallChannel, installType: string | null }>}
 */
export function readInstallContext() {
  const channel = channelFromManifest();
  return Promise.resolve({ channel, installType: null });
}

export async function detectInstallChannel() {
  const { channel } = await readInstallContext();
  return channel;
}

/**
 * Persists install channel for Options UI and default API resolution.
 */
export async function syncInstallMetadata() {
  const { channel, installType } = await readInstallContext();
  await setLocal({
    [STORAGE_INSTALL_META]: {
      channel,
      installType,
      updatedAt: Date.now(),
    },
  });
  return { channel, installType };
}

/**
 * @param {string} [channel]
 */
export function installChannelLabel(channel) {
  if (channel === InstallChannel.LOCAL) return "Local (unpacked / developer)";
  if (channel === InstallChannel.STORE) return "Store install";
  return "Other / unknown";
}
