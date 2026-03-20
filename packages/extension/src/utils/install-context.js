import { getLocal, setLocal } from "./storage.js";
import { STORAGE_INSTALL_META } from "./constants.js";

/**
 * How this build was installed (Chromium `management.getSelf().installType`).
 * - **local** — Load unpacked / developer mode (Chrome, Edge, Opera, etc.).
 * - **store** — Normal install from Chrome Web Store, Opera Add-ons, Edge Add-ons, …
 * - **other** — Enterprise, sideload, or unknown; API default matches **local** unless you set Options.
 */
export const InstallChannel = {
  LOCAL: "local",
  STORE: "store",
  OTHER: "other",
};

/** @param {{ installType?: string } | null | undefined} info */
function channelFromManagementInfo(info) {
  if (!info) return InstallChannel.OTHER;
  if (info.installType === "development") return InstallChannel.LOCAL;
  if (info.installType === "normal") return InstallChannel.STORE;
  return InstallChannel.OTHER;
}

/**
 * @returns {Promise<{ channel: keyof typeof InstallChannel, installType: string | null }>}
 */
export function readInstallContext() {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === "undefined" || !chrome.management?.getSelf) {
        resolve({ channel: InstallChannel.OTHER, installType: null });
        return;
      }
      chrome.management.getSelf((info) => {
        if (chrome.runtime.lastError || !info) {
          resolve({ channel: InstallChannel.OTHER, installType: null });
          return;
        }
        resolve({
          channel: channelFromManagementInfo(info),
          installType: info.installType ?? null,
        });
      });
    } catch {
      resolve({ channel: InstallChannel.OTHER, installType: null });
    }
  });
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
