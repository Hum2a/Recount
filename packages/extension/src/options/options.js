import {
  DEFAULT_API_URL_LOCAL,
  DEFAULT_API_URL_STORE,
  DEFAULT_WEB_URL_LOCAL,
  DEFAULT_WEB_URL_STORE,
  STORAGE_INSTALL_META,
  STORAGE_SETTINGS,
} from "../utils/constants.js";
import { installChannelLabel, syncInstallMetadata } from "../utils/install-context.js";
import { getResolvedApiBase } from "../utils/resolve-api-base.js";
import { getResolvedWebBase } from "../utils/resolve-web-base.js";
import { getLocal, setLocal } from "../utils/storage.js";
import { hasTrackingHostAccess, trackingHostPermissions } from "../utils/tracking-permissions.js";

const apiUrl = /** @type {HTMLInputElement} */ (document.getElementById("apiUrl"));
const webUrl = /** @type {HTMLInputElement} */ (document.getElementById("webUrl"));
const blocked = /** @type {HTMLTextAreaElement} */ (document.getElementById("blocked"));
const status = document.getElementById("status");
const installRow = document.getElementById("install-row");
const trackingStatus = document.getElementById("tracking-status");

async function refreshTrackingStatus() {
  if (!trackingStatus) return;
  const ok = await hasTrackingHostAccess();
  trackingStatus.textContent = ok
    ? "Site access granted — tab time is recorded on HTTP/HTTPS pages."
    : "Site access not granted — use the button below or the same control in the extension popup.";
}

async function load() {
  await syncInstallMetadata();
  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const resolved = await getResolvedApiBase();
  const resolvedWeb = await getResolvedWebBase();

  if (installRow) {
    installRow.textContent = `${installChannelLabel(meta.channel)}${
      meta.installType ? ` · ${meta.installType}` : ""
    }`;
  }

  const s = await getLocal(STORAGE_SETTINGS, {});
  apiUrl.value = typeof s.apiUrl === "string" ? s.apiUrl : "";
  if (!apiUrl.value) {
    apiUrl.placeholder = resolved;
  }
  if (webUrl) {
    webUrl.value = typeof s.webUrl === "string" ? s.webUrl : "";
    if (!webUrl.value) {
      webUrl.placeholder = resolvedWeb;
    }
  }
  blocked.value = Array.isArray(s.blockedDomains) ? s.blockedDomains.join("\n") : "";
  await refreshTrackingStatus();
}

document.getElementById("save").addEventListener("click", async () => {
  const domains = blocked.value
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  const prev = await getLocal(STORAGE_SETTINGS, {});
  await setLocal({
    [STORAGE_SETTINGS]: {
      ...prev,
      apiUrl: apiUrl.value.replace(/\/$/, "") || undefined,
      webUrl: webUrl?.value.replace(/\/$/, "").trim() || undefined,
      blockedDomains: domains,
    },
  });
  status.textContent = "Saved.";
});

document.getElementById("use-local-default")?.addEventListener("click", () => {
  apiUrl.value = DEFAULT_API_URL_LOCAL;
  status.textContent = `Filled: ${DEFAULT_API_URL_LOCAL}`;
});

document.getElementById("use-store-default")?.addEventListener("click", () => {
  apiUrl.value = DEFAULT_API_URL_STORE;
  status.textContent = `Filled: ${DEFAULT_API_URL_STORE}`;
});

document.getElementById("use-local-web-default")?.addEventListener("click", () => {
  if (webUrl) webUrl.value = DEFAULT_WEB_URL_LOCAL;
  status.textContent = `Web URL: ${DEFAULT_WEB_URL_LOCAL}`;
});

document.getElementById("use-store-web-default")?.addEventListener("click", () => {
  if (webUrl) webUrl.value = DEFAULT_WEB_URL_STORE;
  status.textContent = `Web URL: ${DEFAULT_WEB_URL_STORE}`;
});

document.getElementById("grant-tracking-options-btn")?.addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request(trackingHostPermissions());
    status.textContent = granted ? "Site access enabled." : "Permission not granted.";
  } catch {
    status.textContent = "Could not request permission.";
  }
  await refreshTrackingStatus();
});

load();
