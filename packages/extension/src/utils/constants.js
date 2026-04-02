/** Unpacked / developer load — default API (override in Options). */
export const DEFAULT_API_URL_LOCAL = "https://recount-api.humzab1711.workers.dev";

/**
 * Production default when installed from the store (Opera/Chrome Web Store).
 * Replace with your deployed API origin before publishing.
 */
export const DEFAULT_API_URL_STORE = "https://api.recount.app";

/**
 * Public Recount web app (Next.js). No trailing slash.
 * Options → Web URL can override per browser.
 */
export const WEB_APP_ORIGIN = "https://recount.world";

/** Workers preview URL — quick-fill in extension Options for local development. */
export const DEV_WEB_APP_URL = "https://recount-web.humzab1711.workers.dev";

/** @deprecated use DEV_WEB_APP_URL for dev quick-fill */
export const DEFAULT_WEB_URL_LOCAL = DEV_WEB_APP_URL;

/** Packaged production default (store and resolved default when web URL is unset). */
export const DEFAULT_WEB_URL_STORE = WEB_APP_ORIGIN;

export const STORAGE_SESSION = "recount_session";
export const STORAGE_BUFFER = "recount_event_buffer";
export const STORAGE_SETTINGS = "recount_settings";
export const STORAGE_POMODORO = "recount_pomodoro";
export const STORAGE_INTENT_CACHE = "recount_intent_cache";
export const STORAGE_INTENT_NUDGES = "recount_intent_nudges";

export const PREFS_ALARM = "recount_prefs_sync";
/** { channel, installType, updatedAt } — see install-context.js */
export const STORAGE_INSTALL_META = "recount_install_meta";

/** Last batch upload outcome for popup trust UI: { lastFlushOk, lastError?, lastAt? } */
export const STORAGE_SYNC_STATUS = "recount_sync_status";

/** Popup-only prefs: { dateMode?: 'profile'|'local'|'utc' } */
export const STORAGE_POPUP_PREFS = "recount_popup_prefs";

/** Remember last popup tab between opens (MV3 session storage key in popup). */
export const SESSION_POPUP_LAST_TAB = "recount_popup_last_tab";

/** @deprecated use DEFAULT_API_URL_LOCAL */
export const DEFAULT_API_URL = DEFAULT_API_URL_LOCAL;
