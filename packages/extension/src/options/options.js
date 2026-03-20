import {
  DEFAULT_API_URL_LOCAL,
  DEFAULT_API_URL_STORE,
  STORAGE_INSTALL_META,
  STORAGE_SETTINGS,
} from "../utils/constants.js";
import { installChannelLabel, syncInstallMetadata } from "../utils/install-context.js";
import { getResolvedApiBase } from "../utils/resolve-api-base.js";
import { getLocal, setLocal } from "../utils/storage.js";

const apiUrl = /** @type {HTMLInputElement} */ (document.getElementById("apiUrl"));
const blocked = /** @type {HTMLTextAreaElement} */ (document.getElementById("blocked"));
const status = document.getElementById("status");
const installRow = document.getElementById("install-row");

async function load() {
  await syncInstallMetadata();
  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const resolved = await getResolvedApiBase();

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
  blocked.value = Array.isArray(s.blockedDomains) ? s.blockedDomains.join("\n") : "";
}

document.getElementById("save").addEventListener("click", async () => {
  const domains = blocked.value
    .split("\n")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
  await setLocal({
    [STORAGE_SETTINGS]: {
      apiUrl: apiUrl.value.replace(/\/$/, "") || undefined,
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

load();
