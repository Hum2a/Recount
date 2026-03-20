/** Unpacked / developer load — default API (override in Options). */
export const DEFAULT_API_URL_LOCAL = "http://localhost:3001";

/**
 * Production default when installed from the store (Opera/Chrome Web Store).
 * Replace with your deployed API origin before publishing.
 */
export const DEFAULT_API_URL_STORE = "https://api.recount.app";

export const STORAGE_SESSION = "recount_session";
export const STORAGE_BUFFER = "recount_event_buffer";
export const STORAGE_SETTINGS = "recount_settings";
/** { channel, installType, updatedAt } — see install-context.js */
export const STORAGE_INSTALL_META = "recount_install_meta";

/** @deprecated use DEFAULT_API_URL_LOCAL */
export const DEFAULT_API_URL = DEFAULT_API_URL_LOCAL;
