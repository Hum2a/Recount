import { saveSession, clearSession, getSession } from "../utils/auth.js";
import { apiFetch } from "../utils/api-client.js";
import { STORAGE_BUFFER, STORAGE_INSTALL_META, STORAGE_SETTINGS } from "../utils/constants.js";
import { installChannelLabel, syncInstallMetadata } from "../utils/install-context.js";
import { getResolvedApiBase } from "../utils/resolve-api-base.js";
import { getResolvedWebBase } from "../utils/resolve-web-base.js";
import { getLocal } from "../utils/storage.js";
import { hasTrackingHostAccess, trackingHostPermissions } from "../utils/tracking-permissions.js";

/** @type {Record<string, unknown> | null} */
let lastPaymentsExtras = null;

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

function setActiveTab(tabId) {
  for (const btn of document.querySelectorAll(".tab-btn")) {
    const active = btn.getAttribute("data-tab") === tabId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const panel of document.querySelectorAll("[data-tab-panel]")) {
    const active = panel.getAttribute("data-tab-panel") === tabId;
    /** @type {HTMLElement} */ (panel).hidden = !active;
  }
}

function todayUtc() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function formatDuration(sec) {
  const m = Math.round(sec / 60);
  if (m < 1) return "<1 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

/** @param {string} path e.g. `/dashboard` */
async function openWebPath(path) {
  const base = await getResolvedWebBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  chrome.tabs.create({ url: `${base}${p}` });
}

async function loadTodayActivityPreview() {
  const pre = /** @type {HTMLPreElement} */ ($("activity-preview-body"));
  if (!pre) return;
  pre.textContent = "Loading…";
  const date = todayUtc();
  const res = await apiFetch(`/api/events/summary?date=${encodeURIComponent(date)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    pre.textContent =
      body.error === "Free plan limited to the last 7 days"
        ? "This date isn’t available on the free plan. Open Reports on the web."
        : body.error || "Could not load activity.";
    return;
  }
  const d = body.data;
  const total = d?.total_active_sec ?? 0;
  const domains = Array.isArray(d?.domains) ? d.domains : [];
  const lines = [`Total tracked: ${formatDuration(total)}`];
  if (domains.length === 0) {
    lines.push("No tab time recorded for this day yet.");
  } else {
    lines.push("Top sites:");
    for (const row of domains.slice(0, 8)) {
      lines.push(`  • ${row.domain} — ${formatDuration(row.seconds ?? 0)}`);
    }
    if (domains.length > 8) lines.push(`  … +${domains.length - 8} more`);
  }
  pre.textContent = lines.join("\n");
}

async function loadTodayReportPreview() {
  const pre = /** @type {HTMLPreElement} */ ($("report-preview-body"));
  if (!pre) return;
  pre.textContent = "Open Reports on the web, or generate here.";
  const date = todayUtc();
  const res = await apiFetch(`/api/reports/${encodeURIComponent(date)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    pre.textContent = body?.error || "Could not load report.";
    return;
  }
  const d = body.data;
  if (!d) {
    pre.textContent = "No report yet for today.";
    return;
  }
  const score = typeof d.score === "number" ? `Score: ${d.score}/100` : "Score: —";
  const summary = String(d.ai_summary ?? "").trim();
  pre.textContent = summary ? `${score}\n\n${summary}` : score;
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

async function updateTrackingPromptVisibility() {
  const section = /** @type {HTMLElement | null} */ (document.getElementById("tracking-permission-section"));
  if (!section) return;
  section.hidden = await hasTrackingHostAccess();
}

/** @type {ReturnType<typeof setInterval> | null} */
let pomodoroTick = null;

function clearPomodoroTick() {
  if (pomodoroTick) {
    clearInterval(pomodoroTick);
    pomodoroTick = null;
  }
}

function updatePomodoroDisplay() {
  const status = $("pomodoro-status");
  if (!status) return;
  chrome.runtime.sendMessage({ type: "pomodoro-state" }, (p) => {
    if (chrome.runtime.lastError) {
      status.textContent = "—";
      return;
    }
    if (!p?.endMs || Date.now() >= Number(p.endMs)) {
      status.textContent = "No active timer.";
      return;
    }
    const left = Math.max(0, Math.ceil((Number(p.endMs) - Date.now()) / 1000));
    const mm = Math.floor(left / 60);
    const ss = left % 60;
    status.textContent = `Focus: ${mm}:${String(ss).padStart(2, "0")}`;
  });
}

function startPomodoroTick() {
  clearPomodoroTick();
  updatePomodoroDisplay();
  pomodoroTick = setInterval(updatePomodoroDisplay, 1000);
}

async function loadStreaks() {
  const row = $("streak-row");
  if (!row) return;
  const res = await apiFetch("/api/profiles/me/streaks");
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.data) {
    row.hidden = true;
    return;
  }
  const d = body.data;
  row.textContent = `Streaks — intentions: ${d.intention_streak ?? 0} day(s), tracking: ${d.tracking_streak ?? 0} day(s) (≥${d.tracking_min_sec_per_day ? Math.round(d.tracking_min_sec_per_day / 60) : 5} min/day).`;
  row.hidden = false;
}

function openExtensionOptions() {
  chrome.runtime.openOptionsPage(() => void chrome.runtime.lastError);
}

async function loadAccountPanel() {
  const api = await getResolvedApiBase();
  const web = await getResolvedWebBase();
  const apiEl = $("acct-api-url");
  const webEl = $("acct-web-url");
  if (apiEl) apiEl.textContent = `API · ${api}`;
  if (webEl) webEl.textContent = `Web · ${web}`;

  const settings = await getLocal(STORAGE_SETTINGS, {});
  const blocked = Array.isArray(settings.blockedDomains) ? settings.blockedDomains.length : 0;
  const bc = $("acct-blocked-count");
  if (bc) bc.textContent = String(blocked);

  const licEl = $("acct-license");
  const key = lastPaymentsExtras && typeof lastPaymentsExtras.license_key === "string" ? lastPaymentsExtras.license_key : null;
  if (licEl) {
    if (key) {
      licEl.hidden = false;
      licEl.textContent = `License key: …${String(key).slice(-10)}`;
    } else {
      licEl.hidden = true;
    }
  }

  const res = await apiFetch("/api/profiles/me");
  const body = await res.json().catch(() => ({}));
  const emailEl = $("acct-email");
  if (!res.ok || !body.data) {
    if (emailEl) emailEl.textContent = "—";
    const dc = $("acct-distraction-count");
    if (dc) dc.textContent = "—";
    return;
  }
  const p = body.data;
  if (emailEl) emailEl.textContent = p.email ?? "—";

  const st = /** @type {HTMLInputElement | null} */ ($("acct-send-titles"));
  if (st) st.checked = p.send_tab_titles !== false;
  const il = /** @type {HTMLInputElement | null} */ ($("acct-intent-lock"));
  if (il) il.checked = Boolean(p.intent_lock_enabled);
  const wd = /** @type {HTMLInputElement | null} */ ($("acct-weekly-digest"));
  if (wd) wd.checked = Boolean(p.weekly_digest_enabled);

  const dist = Array.isArray(p.distraction_domains) ? p.distraction_domains.length : 0;
  const dc = $("acct-distraction-count");
  if (dc) dc.textContent = String(dist);
}

/**
 * @param {Record<string, unknown>} partial
 * @returns {Promise<boolean>}
 */
async function patchProfileField(partial) {
  const res = await apiFetch("/api/profiles", {
    method: "PATCH",
    body: JSON.stringify(partial),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    setMsg(typeof body.error === "string" ? body.error : "Could not save.");
    await loadAccountPanel();
    return false;
  }
  chrome.runtime.sendMessage({ type: "prefs-sync-now" }, () => void chrome.runtime.lastError);
  setMsg("Saved.", true);
  await loadAccountPanel();
  return true;
}

function logDev(message, detail) {
  const el = $("dev-log");
  if (!el) return;
  const tail = detail !== undefined ? `\n${typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)}` : "";
  const line = `[${new Date().toISOString().slice(11, 19)}] ${message}${tail}\n\n`;
  el.textContent = (line + el.textContent).slice(0, 6000);
}

async function refreshDevPanelStats() {
  const pre = $("dev-stats");
  if (!pre) return;
  try {
    const rawBuf = await getLocal(STORAGE_BUFFER);
    const buf = Array.isArray(rawBuf) ? rawBuf : [];
    const tabs = await chrome.tabs.query({});
    const session = await getSession();
    const localSettings = await getLocal(STORAGE_SETTINGS, {});
    const blocked = Array.isArray(localSettings.blockedDomains) ? localSettings.blockedDomains.length : 0;
    const pom = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "pomodoro-state" }, (p) => resolve(p && typeof p === "object" ? p : {}));
    });
    const tracking = await hasTrackingHostAccess();
    let expiresLine = "Session: no expiry metadata";
    if (session?.expires_at != null) {
      const raw = session.expires_at;
      const expMs = typeof raw === "number" && raw < 1e12 ? raw * 1000 : Number(raw);
      expiresLine = Number.isFinite(expMs) ? `Session expiry (UTC): ${new Date(expMs).toISOString()}` : "Session: (unparsed expiry)";
    }
    const endMs = pom && "endMs" in pom ? Number(pom.endMs) : 0;
    const pomLine =
      endMs && Date.now() < endMs ? `Pomodoro ends (UTC): ${new Date(endMs).toISOString()}` : "Pomodoro: inactive";
    pre.textContent = [
      `Local event buffer: ${buf.length} queued`,
      `Open tabs (all windows): ${tabs.length}`,
      `Blocked domains (extension options): ${blocked}`,
      `Site access (http/https): ${tracking ? "yes" : "no"}`,
      expiresLine,
      pomLine,
    ].join("\n");
  } catch (e) {
    pre.textContent = e instanceof Error ? e.message : "Could not read stats.";
  }
}

async function pingHealth() {
  const base = await getResolvedApiBase();
  const t0 = performance.now();
  try {
    const res = await fetch(`${base}/health`);
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    logDev(`GET /health → ${res.status} (${ms}ms)`, text.slice(0, 800));
  } catch (e) {
    logDev("GET /health failed", e instanceof Error ? e.message : String(e));
  }
}

/**
 * @param {string} label
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function pingApiPath(label, path, init) {
  const t0 = performance.now();
  try {
    const res = await apiFetch(path, init ?? { method: "GET" });
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    logDev(`${label} → ${res.status} (${ms}ms)`, text.slice(0, 1200));
  } catch (e) {
    logDev(`${label} failed`, e instanceof Error ? e.message : String(e));
  }
}

async function refreshUI() {
  await updateTrackingPromptVisibility();
  await refreshInstallBadge();
  const session = await getSession();
  const auth = $("auth-section");
  const app = $("app-section");
  if (session?.access_token) {
    auth.hidden = true;
    app.hidden = false;
    setActiveTab("today");
    const res = await apiFetch("/api/payments/status");
    const body = await res.json().catch(() => ({}));
    lastPaymentsExtras = body.data && typeof body.data === "object" ? body.data : null;
    const role = String(body.data?.app_role ?? "user");
    const hasLicense = Boolean(body.data?.license_active);
    const privileged = role === "admin" || role === "developer";
    const licensed = hasLicense || privileged;
    const devTabBtn = $("tab-btn-dev");
    if (devTabBtn) devTabBtn.hidden = !privileged;
    $("welcome").textContent = licensed
      ? "Signed in — full access."
      : "Signed in — free plan (7-day history, no AI reports).";
    const genBtn = $("generate-report-btn");
    if (genBtn) genBtn.hidden = !licensed;
    const roleChip = $("role-chip");
    if (roleChip) roleChip.textContent = `Role: ${role}`;
    const planChip = $("plan-chip");
    if (planChip) planChip.textContent = `Plan: ${licensed ? "full" : "free"}`;
    const hint = $("account-hint");
    if (hint) {
      hint.textContent = privileged
        ? "Staff access enabled (admin/developer). Some features may be available even without a paid license."
        : hasLicense
          ? "License active."
          : "No active license on this profile.";
    }
    const unlockBtn = $("unlock-btn");
    if (unlockBtn) unlockBtn.hidden = licensed;
    await loadAccountPanel();
    await loadTodayActivityPreview();
    await loadStreaks();
    if (licensed) await loadTodayReportPreview();
    startPomodoroTick();
  } else {
    lastPaymentsExtras = null;
    clearPomodoroTick();
    auth.hidden = false;
    app.hidden = true;
  }
}

$("grant-tracking-btn")?.addEventListener("click", async () => {
  setMsg("");
  try {
    const granted = await chrome.permissions.request(trackingHostPermissions());
    if (!granted) {
      setMsg("Site access wasn’t granted — tab time won’t be recorded.");
      return;
    }
    setMsg("Site access enabled — tab tracking is on.", true);
  } catch {
    setMsg("Could not request permission.");
    return;
  }
  await updateTrackingPromptVisibility();
});

$("open-web-login-btn")?.addEventListener("click", () => {
  void openWebPath("/login");
});

$("open-dashboard-btn")?.addEventListener("click", () => {
  void openWebPath("/dashboard");
});

$("open-reports-btn")?.addEventListener("click", () => {
  void openWebPath("/dashboard/reports");
});

$("refresh-activity-btn")?.addEventListener("click", async () => {
  await loadTodayActivityPreview();
});

$("generate-report-btn")?.addEventListener("click", async () => {
  setMsg("");
  const pre = /** @type {HTMLPreElement} */ ($("report-preview-body"));
  if (pre) pre.textContent = "Generating… (this can take ~10–30s)";
  const date = todayUtc();
  const res = await apiFetch("/api/reports/generate", {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (pre) pre.textContent = body?.error || "Could not generate.";
    setMsg(body?.error || "Could not generate report.");
    return;
  }
  setMsg("Report generated.", true);
  await loadTodayReportPreview();
});

$("flush-now-btn")?.addEventListener("click", () => {
  setMsg("");
  chrome.runtime.sendMessage({ type: "flush-now" }, (r) => {
    if (chrome.runtime.lastError) {
      setMsg("Could not upload right now.");
      return;
    }
    setMsg(r?.ok ? "Uploaded." : "Upload failed.", Boolean(r?.ok));
  });
});

$("sync-prefs-btn")?.addEventListener("click", () => {
  setMsg("");
  chrome.runtime.sendMessage({ type: "prefs-sync-now" }, (r) => {
    if (chrome.runtime.lastError) {
      setMsg("Could not sync settings.");
      return;
    }
    setMsg(r?.ok ? "Settings synced." : "Sync failed.", Boolean(r?.ok));
    if (r?.ok) void loadAccountPanel();
  });
});

$("acct-send-titles")?.addEventListener("change", async (e) => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  await patchProfileField({ send_tab_titles: t.checked });
});

$("acct-intent-lock")?.addEventListener("change", async (e) => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  await patchProfileField({ intent_lock_enabled: t.checked });
});

$("acct-weekly-digest")?.addEventListener("change", async (e) => {
  const t = /** @type {HTMLInputElement} */ (e.target);
  await patchProfileField({ weekly_digest_enabled: t.checked });
});

$("acct-open-options")?.addEventListener("click", () => openExtensionOptions());
$("open-ext-options-btn")?.addEventListener("click", () => openExtensionOptions());
$("open-web-settings-btn")?.addEventListener("click", () => {
  void openWebPath("/dashboard/settings");
});

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

$("goals")?.addEventListener("focus", async () => {
  const t = /** @type {HTMLTextAreaElement} */ ($("goals"));
  if (!t || t.value.trim().length) return;
  const intRes = await apiFetch(`/api/intentions/${todayUtc()}`);
  const intBody = await intRes.json().catch(() => ({}));
  const goals = intBody.data?.goals;
  t.value = Array.isArray(goals) ? goals.join("\n") : "";
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

for (const btn of document.querySelectorAll("[data-pom-min]")) {
  btn.addEventListener("click", () => {
    const m = Number(btn.getAttribute("data-pom-min"));
    chrome.runtime.sendMessage({ type: "pomodoro-start", minutes: m }, () => {
      void chrome.runtime.lastError;
      startPomodoroTick();
    });
  });
}

$("pomodoro-stop")?.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "pomodoro-stop" }, () => {
    void chrome.runtime.lastError;
    updatePomodoroDisplay();
  });
});

for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => {
    const tab = btn.getAttribute("data-tab") || "today";
    setActiveTab(tab);
    if (tab === "dev") void refreshDevPanelStats();
  });
}

$("dev-refresh-stats")?.addEventListener("click", () => {
  void refreshDevPanelStats();
});
$("dev-clear-log")?.addEventListener("click", () => {
  const el = $("dev-log");
  if (el) el.textContent = "";
});
$("dev-ping-health")?.addEventListener("click", () => {
  void pingHealth();
});
$("dev-ping-profile")?.addEventListener("click", () => {
  void pingApiPath("GET /api/profiles/me", "/api/profiles/me");
});
$("dev-ping-payments")?.addEventListener("click", () => {
  void pingApiPath("GET /api/payments/status", "/api/payments/status");
});
$("dev-ping-events")?.addEventListener("click", () => {
  void pingApiPath("GET /api/events/summary", `/api/events/summary?date=${encodeURIComponent(todayUtc())}`);
});
$("dev-ping-intentions")?.addEventListener("click", () => {
  void pingApiPath("GET /api/intentions", `/api/intentions/${encodeURIComponent(todayUtc())}`);
});
$("dev-ping-reports")?.addEventListener("click", () => {
  void pingApiPath("GET /api/reports/:today", `/api/reports/${encodeURIComponent(todayUtc())}`);
});
$("dev-ping-team")?.addEventListener("click", () => {
  void pingApiPath("GET /api/team/leaderboard", "/api/team/leaderboard");
});
$("dev-ping-admin")?.addEventListener("click", () => {
  void pingApiPath("GET /api/admin/users", "/api/admin/users?limit=3&offset=0");
});

void refreshUI();
