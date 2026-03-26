import {
  STORAGE_BUFFER,
  STORAGE_SETTINGS,
  STORAGE_POMODORO,
  STORAGE_INTENT_CACHE,
  STORAGE_INTENT_NUDGES,
  PREFS_ALARM,
} from "../utils/constants.js";
import { classifyDomain } from "../utils/domain-classify.js";
import { getLocal, setLocal } from "../utils/storage.js";
import { syncInstallMetadata } from "../utils/install-context.js";
import { apiFetch } from "../utils/api-client.js";
import { hasTrackingHostAccess } from "../utils/tracking-permissions.js";

const FLUSH_ALARM = "recount_flush";
const EOD_ALARM = "recount_eod";
const POMODORO_ALARM = "recount_pomodoro_end";
const MAX_BUFFER = 500;

/** @type {{ domain: string, title: string | null, startIso: string, tabId: number } | null} */
let current = null;

async function loadSettings() {
  const s = await getLocal(STORAGE_SETTINGS, {});
  return {
    blockedDomains: Array.isArray(s.blockedDomains) ? s.blockedDomains.map(String) : [],
    distractionDomains: Array.isArray(s.distractionDomains) ? s.distractionDomains.map(String) : [],
    intentLockEnabled: Boolean(s.intentLockEnabled),
    sendTabTitles: s.sendTabTitles !== false,
  };
}

function isBlocked(hostname, blocked) {
  const h = (hostname || "").toLowerCase();
  return blocked.some((b) => h === b || h.endsWith(`.${b}`));
}

function shouldSkipUrl(url) {
  if (!url) return true;
  if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
    return true;
  }
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname.endsWith(".localhost")) return true;
    return false;
  } catch {
    return true;
  }
}

function domainFromUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function syncProfilePrefs() {
  const res = await apiFetch("/api/profiles/me");
  if (!res.ok) return;
  const body = await res.json().catch(() => ({}));
  const row = body.data;
  if (!row) return;
  const prev = await getLocal(STORAGE_SETTINGS, {});
  await setLocal({
    [STORAGE_SETTINGS]: {
      ...prev,
      distractionDomains: Array.isArray(row.distraction_domains) ? row.distraction_domains.map(String) : [],
      intentLockEnabled: Boolean(row.intent_lock_enabled),
      sendTabTitles: row.send_tab_titles !== false,
    },
  });
}

async function hasGoalsTodayCached() {
  const day = todayUtc();
  const cache = await getLocal(STORAGE_INTENT_CACHE, {});
  if (cache.date === day && typeof cache.hasGoals === "boolean" && Date.now() - (cache.fetchedAt ?? 0) < 10 * 60_000) {
    return cache.hasGoals;
  }
  const res = await apiFetch(`/api/intentions/${day}`);
  const body = await res.json().catch(() => ({}));
  const goals = body.data?.goals;
  const hasGoals = Array.isArray(goals) && goals.some((g) => String(g).trim().length > 0);
  await setLocal({
    [STORAGE_INTENT_CACHE]: { date: day, hasGoals, fetchedAt: Date.now() },
  });
  return hasGoals;
}

async function maybeIntentLockNudge(domain, tabId) {
  if (!domain || tabId == null) return;
  const s = await loadSettings();
  if (!s.intentLockEnabled || !s.distractionDomains.length) return;
  if (!isBlocked(domain, s.distractionDomains)) return;
  if (!(await hasGoalsTodayCached())) return;

  const day = todayUtc();
  const state = await getLocal(STORAGE_INTENT_NUDGES, { day: "", domains: {} });
  /** @type {{ day: string, domains: Record<string, number> }} */
  const next =
    state.day === day ? state : { day, domains: {} };
  if (next.domains[domain]) return;
  next.domains[domain] = Date.now();
  await setLocal({ [STORAGE_INTENT_NUDGES]: next });

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: "Recount — intent check",
    message: `You planned focused work today. ${domain} is on your distraction list.`,
  });

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab?.id && tab.url && !shouldSkipUrl(tab.url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/intent-nudge.js"],
      });
    } catch {
      /* restricted pages */
    }
  }
}

async function pushBuffer(event) {
  const buf = (await getLocal(STORAGE_BUFFER)) ?? [];
  buf.push(event);
  if (buf.length >= MAX_BUFFER) {
    await setLocal({ [STORAGE_BUFFER]: [] });
    await flushEvents(buf);
  } else {
    await setLocal({ [STORAGE_BUFFER]: buf });
  }
}

async function closeCurrent(endIso = new Date().toISOString()) {
  if (!current) return;
  const settings = await loadSettings();
  const pomodoro = await getLocal(STORAGE_POMODORO, {});
  const sessionId =
    pomodoro.sessionId && pomodoro.endMs && Date.now() < Number(pomodoro.endMs) ? pomodoro.sessionId : null;

  const ev = {
    domain: current.domain,
    title: settings.sendTabTitles ? current.title : null,
    start_time: current.startIso,
    end_time: endIso,
    category: classifyDomain(current.domain),
  };
  if (sessionId) ev.focus_session_id = sessionId;
  current = null;
  await pushBuffer(ev);
}

async function startFromTab(tabId) {
  if (!(await hasTrackingHostAccess())) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.url || shouldSkipUrl(tab.url)) return;
  const settings = await loadSettings();
  const domain = domainFromUrl(tab.url);
  if (!domain || isBlocked(domain, settings.blockedDomains)) return;

  await closeCurrent();
  current = {
    domain,
    title: tab.title ?? null,
    startIso: new Date().toISOString(),
    tabId,
  };
  void maybeIntentLockNudge(domain, tabId);
}

async function flushPending(extra = []) {
  const buf = ((await getLocal(STORAGE_BUFFER)) ?? []).concat(extra);
  await setLocal({ [STORAGE_BUFFER]: [] });
  if (buf.length === 0) return;
  await flushEvents(buf);
}

async function flushEvents(events) {
  const res = await apiFetch("/api/events/batch", {
    method: "POST",
    body: JSON.stringify({ events }),
  });
  if (!res.ok) {
    const prev = (await getLocal(STORAGE_BUFFER)) ?? [];
    await setLocal({ [STORAGE_BUFFER]: prev.concat(events) });
  }
}

function scheduleFlushAlarm() {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 5 });
}

function schedulePrefsAlarm() {
  chrome.alarms.create(PREFS_ALARM, { periodInMinutes: 30 });
}

function nextSixPmMs() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

function scheduleEodAlarm() {
  chrome.alarms.create(EOD_ALARM, { when: nextSixPmMs() });
}

async function eodNudge() {
  scheduleEodAlarm();
  if (!(await hasTrackingHostAccess())) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/128.png",
      title: "Recount",
      message:
        "End of day — open Recount and allow site access to enable tab tracking and in-page reminders.",
    });
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id && tab.url && !shouldSkipUrl(tab.url)) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/eod-nudge.js"],
      });
    } catch {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/128.png",
        title: "Recount",
        message: "End of day — open the extension to review your intentions vs. your tabs.",
      });
    }
  } else {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/128.png",
      title: "Recount",
      message: "End of day check-in: open Recount from the toolbar.",
    });
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  scheduleFlushAlarm();
  scheduleEodAlarm();
  schedulePrefsAlarm();
  chrome.idle.setDetectionInterval(180);
  void syncInstallMetadata();
  void syncProfilePrefs();

  if (details.reason === "install") {
    chrome.runtime.openOptionsPage(() => {
      void chrome.runtime.lastError;
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  scheduleFlushAlarm();
  scheduleEodAlarm();
  schedulePrefsAlarm();
  chrome.idle.setDetectionInterval(180);
  void syncInstallMetadata();
  void syncProfilePrefs();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "prefs-sync-now") {
    void (async () => {
      await syncProfilePrefs();
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === "flush-now") {
    void (async () => {
      await flushPending();
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === "pomodoro-start") {
    const minutes = Math.min(180, Math.max(1, Number(msg.minutes) || 25));
    const sessionId = crypto.randomUUID();
    const endMs = Date.now() + minutes * 60_000;
    void (async () => {
      await setLocal({ [STORAGE_POMODORO]: { sessionId, endMs } });
      await chrome.alarms.clear(POMODORO_ALARM);
      chrome.alarms.create(POMODORO_ALARM, { when: endMs });
      sendResponse({ ok: true, sessionId, endMs });
    })();
    return true;
  }
  if (msg?.type === "pomodoro-stop") {
    void (async () => {
      await setLocal({ [STORAGE_POMODORO]: {} });
      await chrome.alarms.clear(POMODORO_ALARM);
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (msg?.type === "pomodoro-state") {
    void getLocal(STORAGE_POMODORO, {}).then((p) => sendResponse(p));
    return true;
  }
  return undefined;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await startFromTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status === "complete" && tab.active) {
    await startFromTab(tabId);
  }
  if (current && tabId === current.tabId && typeof info.title === "string") {
    current.title = info.title;
  }
});

chrome.windows.onFocusChanged.addListener(async (winId) => {
  if (winId === chrome.windows.WINDOW_ID_NONE) {
    await closeCurrent();
  } else {
    const tabs = await chrome.tabs.query({ active: true, windowId: winId });
    const t = tabs[0];
    if (t?.id) await startFromTab(t.id);
  }
});

chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await closeCurrent();
  }
});

chrome.permissions.onRemoved.addListener(async () => {
  if (!(await hasTrackingHostAccess())) {
    await closeCurrent();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushPending();
  }
  if (alarm.name === EOD_ALARM) {
    await eodNudge();
  }
  if (alarm.name === PREFS_ALARM) {
    await syncProfilePrefs();
  }
  if (alarm.name === POMODORO_ALARM) {
    await setLocal({ [STORAGE_POMODORO]: {} });
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/128.png",
      title: "Recount",
      message: "Focus timer finished.",
    });
  }
});
