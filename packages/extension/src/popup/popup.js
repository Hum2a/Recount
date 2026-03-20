import { saveSession, clearSession, getSession } from "../utils/auth.js";
import { apiFetch } from "../utils/api-client.js";
import { STORAGE_INSTALL_META } from "../utils/constants.js";
import { installChannelLabel, syncInstallMetadata } from "../utils/install-context.js";
import { getResolvedApiBase } from "../utils/resolve-api-base.js";
import { getLocal } from "../utils/storage.js";

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

function todayUtc() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function setMsg(text, ok = false) {
  const m = $("msg");
  m.textContent = text;
  m.style.color = ok ? "#4ade80" : "#f87171";
}

async function refreshInstallBadge() {
  await syncInstallMetadata();
  const meta = await getLocal(STORAGE_INSTALL_META, {});
  const el = $("install-context");
  if (el) {
    el.textContent = installChannelLabel(meta.channel);
    el.title = meta.installType ? `installType: ${meta.installType}` : "";
  }
}

async function refreshUI() {
  await refreshInstallBadge();
  const session = await getSession();
  const auth = $("auth-section");
  const app = $("app-section");
  if (session?.access_token) {
    auth.hidden = true;
    app.hidden = false;
    const res = await apiFetch("/api/payments/status");
    const body = await res.json().catch(() => ({}));
    const licensed = body.data?.license_active;
    $("welcome").textContent = licensed
      ? "Signed in — full access."
      : "Signed in — free plan (7-day history, no AI reports).";

    const intRes = await apiFetch(`/api/intentions/${todayUtc()}`);
    const intBody = await intRes.json().catch(() => ({}));
    const goals = intBody.data?.goals;
    $("goals").value = Array.isArray(goals) ? goals.join("\n") : "";
  } else {
    auth.hidden = false;
    app.hidden = true;
  }
}

$("login-btn").addEventListener("click", async () => {
  setMsg("");
  const email = /** @type {HTMLInputElement} */ ($("email")).value.trim();
  const password = /** @type {HTMLInputElement} */ ($("password")).value;
  const base = await getResolvedApiBase();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(body.error || "Login failed");
    return;
  }
  const s = body.data?.session;
  if (!s?.access_token) {
    setMsg("No session returned");
    return;
  }
  await saveSession({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
  });
  setMsg("Signed in.", true);
  await refreshUI();
});

$("signup-btn").addEventListener("click", async () => {
  setMsg("");
  const email = /** @type {HTMLInputElement} */ ($("email")).value.trim();
  const password = /** @type {HTMLInputElement} */ ($("password")).value;
  if (password.length < 8) {
    setMsg("Password must be at least 8 characters.");
    return;
  }
  const base = await getResolvedApiBase();
  const res = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(body.error || "Signup failed");
    return;
  }
  const s = body.data?.session;
  if (s?.access_token) {
    await saveSession({
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
    });
    setMsg("Account created — you’re signed in.", true);
    await refreshUI();
    return;
  }
  setMsg("Check your email to confirm, then sign in.");
});

$("save-goals").addEventListener("click", async () => {
  setMsg("");
  const raw = /** @type {HTMLTextAreaElement} */ ($("goals")).value;
  const goals = raw
    .split("\n")
    .map((g) => g.trim())
    .filter(Boolean);
  if (goals.length === 0) {
    setMsg("Add at least one goal.");
    return;
  }
  const res = await apiFetch("/api/intentions", {
    method: "POST",
    body: JSON.stringify({ date: todayUtc(), goals }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(body.error || "Could not save");
    return;
  }
  setMsg("Intentions saved.", true);
});

$("unlock-btn").addEventListener("click", async () => {
  setMsg("");
  const res = await apiFetch("/api/payments/create-session", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  const url = body.data?.url;
  if (!url) {
    setMsg(body.error || "Could not start checkout");
    return;
  }
  chrome.tabs.create({ url });
});

$("logout-btn").addEventListener("click", async () => {
  await clearSession();
  await refreshUI();
  setMsg("Signed out.", true);
});

void refreshUI();
