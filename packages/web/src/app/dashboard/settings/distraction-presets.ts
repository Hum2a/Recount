/** Curated hostnames for intent-lock nudges (no protocol; lowercase). */

export type DistractionPresetItem = { host: string; label: string };

export type DistractionPresetGroup = { id: string; label: string; items: DistractionPresetItem[] };

export const DISTRACTION_PRESET_GROUPS: DistractionPresetGroup[] = [
  {
    id: "social",
    label: "Social & messaging",
    items: [
      { host: "facebook.com", label: "Facebook" },
      { host: "instagram.com", label: "Instagram" },
      { host: "twitter.com", label: "X (Twitter)" },
      { host: "x.com", label: "X" },
      { host: "threads.net", label: "Threads" },
      { host: "tiktok.com", label: "TikTok" },
      { host: "snapchat.com", label: "Snapchat" },
      { host: "pinterest.com", label: "Pinterest" },
      { host: "reddit.com", label: "Reddit" },
      { host: "tumblr.com", label: "Tumblr" },
      { host: "linkedin.com", label: "LinkedIn" },
      { host: "bsky.app", label: "Bluesky" },
      { host: "mastodon.social", label: "Mastodon (social)" },
      { host: "discord.com", label: "Discord" },
      { host: "web.whatsapp.com", label: "WhatsApp Web" },
      { host: "messenger.com", label: "Messenger" },
      { host: "web.telegram.org", label: "Telegram Web" },
      { host: "slack.com", label: "Slack" },
      { host: "teams.microsoft.com", label: "Microsoft Teams" },
    ],
  },
  {
    id: "video",
    label: "Video & streaming",
    items: [
      { host: "youtube.com", label: "YouTube" },
      { host: "netflix.com", label: "Netflix" },
      { host: "twitch.tv", label: "Twitch" },
      { host: "disneyplus.com", label: "Disney+" },
      { host: "primevideo.com", label: "Prime Video" },
      { host: "hulu.com", label: "Hulu" },
      { host: "max.com", label: "Max (HBO)" },
      { host: "paramountplus.com", label: "Paramount+" },
      { host: "peacocktv.com", label: "Peacock" },
      { host: "crunchyroll.com", label: "Crunchyroll" },
      { host: "vimeo.com", label: "Vimeo" },
      { host: "dailymotion.com", label: "Dailymotion" },
    ],
  },
  {
    id: "news",
    label: "News & forums",
    items: [
      { host: "bbc.co.uk", label: "BBC" },
      { host: "bbc.com", label: "BBC.com" },
      { host: "cnn.com", label: "CNN" },
      { host: "theguardian.com", label: "The Guardian" },
      { host: "nytimes.com", label: "New York Times" },
      { host: "washingtonpost.com", label: "Washington Post" },
      { host: "news.ycombinator.com", label: "Hacker News" },
      { host: "medium.com", label: "Medium" },
      { host: "substack.com", label: "Substack" },
      { host: "quora.com", label: "Quora" },
      { host: "flipboard.com", label: "Flipboard" },
    ],
  },
  {
    id: "games",
    label: "Games",
    items: [
      { host: "steampowered.com", label: "Steam" },
      { host: "store.steampowered.com", label: "Steam Store" },
      { host: "epicgames.com", label: "Epic Games" },
      { host: "roblox.com", label: "Roblox" },
      { host: "minecraft.net", label: "Minecraft" },
      { host: "chess.com", label: "Chess.com" },
      { host: "lichess.org", label: "Lichess" },
    ],
  },
  {
    id: "shopping",
    label: "Shopping & deals",
    items: [
      { host: "amazon.com", label: "Amazon" },
      { host: "amazon.co.uk", label: "Amazon UK" },
      { host: "ebay.com", label: "eBay" },
      { host: "etsy.com", label: "Etsy" },
      { host: "aliexpress.com", label: "AliExpress" },
      { host: "wish.com", label: "Wish" },
    ],
  },
  {
    id: "sports",
    label: "Sports & scores",
    items: [
      { host: "espn.com", label: "ESPN" },
      { host: "skysports.com", label: "Sky Sports" },
      { host: "goal.com", label: "Goal" },
      { host: "thescore.com", label: "theScore" },
    ],
  },
  {
    id: "other",
    label: "Other common distractions",
    items: [
      { host: "imgur.com", label: "Imgur" },
      { host: "9gag.com", label: "9GAG" },
      { host: "buzzfeed.com", label: "BuzzFeed" },
      { host: "imdb.com", label: "IMDb" },
      { host: "letterboxd.com", label: "Letterboxd" },
      { host: "goodreads.com", label: "Goodreads" },
      { host: "spotify.com", label: "Spotify" },
      { host: "soundcloud.com", label: "SoundCloud" },
      { host: "audible.com", label: "Audible" },
      { host: "notion.so", label: "Notion" },
      { host: "canva.com", label: "Canva" },
    ],
  },
];

const _presetHostSet = new Set<string>();
for (const g of DISTRACTION_PRESET_GROUPS) {
  for (const { host } of g.items) {
    _presetHostSet.add(host);
  }
}

/** Every preset hostname (for splitting saved profile into picker vs custom). */
export function getPresetHostSet(): ReadonlySet<string> {
  return _presetHostSet;
}

export function isPresetHost(host: string): boolean {
  return _presetHostSet.has(host.trim().toLowerCase());
}

/** Client-side hostname cleanup; server applies its own normalisation on save. */
export function normalizeDistractionHostInput(line: string): string | null {
  let s = line.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/^www\./, "");
  const host = s.split("/")[0]?.split(":")[0]?.trim() ?? "";
  if (!host || host.length > 253) return null;
  return host;
}

export function parseCustomDistractionLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const h = normalizeDistractionHostInput(line);
    if (h && !seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}
