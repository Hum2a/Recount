import { STORAGE_BUFFER, STORAGE_SETTINGS } from "../utils/constants.js";
import { classifyDomain } from "../utils/domain-classify.js";
import { getLocal, setLocal } from "../utils/storage.js";
import { syncInstallMetadata } from "../utils/install-context.js";
import { apiFetch } from "../utils/api-client.js";

const FLUSH_ALARM = "recount_flush";
const EOD_ALARM = "recount_eod";
const MAX_BUFFER = 500;

/** @type {{ domain: string, title: string | null, startIso: string, tabId: number } | null} */
let current = null;

async function loadSettings() {
  const s = await getLocal(STORAGE_SETTINGS, {});
  return {
    blockedDomains: Array.isArray(s.blockedDomains) ? s.blockedDomains.map(String) : [],
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
  const ev = {
    domain: current.domain,
    title: current.title,
    start_time: current.startIso,
    end_time: endIso,
    category: classifyDomain(current.domain),
  };
  current = null;
  await pushBuffer(ev);
}

async function startFromTab(tabId) {
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

chrome.runtime.onInstalled.addListener(() => {
  scheduleFlushAlarm();
  scheduleEodAlarm();
  chrome.idle.setDetectionInterval(180);
  void syncInstallMetadata();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleFlushAlarm();
  scheduleEodAlarm();
  chrome.idle.setDetectionInterval(180);
  void syncInstallMetadata();
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

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === FLUSH_ALARM) {
    await flushPending();
  }
  if (alarm.name === EOD_ALARM) {
    await eodNudge();
  }
});
