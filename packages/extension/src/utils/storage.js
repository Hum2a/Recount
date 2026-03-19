/**
 * @template T
 * @param {string} key
 * @param {T} [fallback]
 * @returns {Promise<T|undefined>}
 */
export async function getLocal(key, fallback) {
  const obj = await chrome.storage.local.get(key);
  return key in obj ? obj[key] : fallback;
}

/**
 * @param {Record<string, unknown>} patch
 */
export async function setLocal(patch) {
  await chrome.storage.local.set(patch);
}
