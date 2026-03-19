/** @type {Record<string, string>} */
export const DOMAIN_CATEGORIES = {
  "github.com": "dev",
  "stackoverflow.com": "dev",
  "linear.app": "work",
  "notion.so": "work",
  "youtube.com": "video",
  "reddit.com": "social",
  "twitter.com": "social",
  "x.com": "social",
  "tiktok.com": "video",
  "instagram.com": "social",
  "bbc.co.uk": "news",
  "theguardian.com": "news",
  "amazon.co.uk": "shopping",
  "amazon.com": "shopping",
};

/**
 * @param {string} domain
 * @returns {string}
 */
export function classifyDomain(domain) {
  const d = domain?.toLowerCase?.() ?? "";
  return DOMAIN_CATEGORIES[d] ?? "other";
}
