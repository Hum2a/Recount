/**
 * Optional host access for reading tab URLs and injecting the EOD banner.
 * Keep in sync with `optional_host_permissions` in `manifest.json`.
 */
export const TRACKING_HOST_PATTERNS = ["http://*/*", "https://*/*"];

/** @returns {{ origins: string[] }} */
export function trackingHostPermissions() {
  return { origins: TRACKING_HOST_PATTERNS };
}

export async function hasTrackingHostAccess() {
  try {
    return await chrome.permissions.contains(trackingHostPermissions());
  } catch {
    return false;
  }
}
