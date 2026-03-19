import { STORAGE_SETTINGS } from "../utils/constants.js";
import { getLocal, setLocal } from "../utils/storage.js";

const apiUrl = /** @type {HTMLInputElement} */ (document.getElementById("apiUrl"));
const blocked = /** @type {HTMLTextAreaElement} */ (document.getElementById("blocked"));
const status = document.getElementById("status");

async function load() {
  const s = await getLocal(STORAGE_SETTINGS, {});
  apiUrl.value = s.apiUrl || "";
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

load();
