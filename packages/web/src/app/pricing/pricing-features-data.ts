export type PricingFeatureDetail = {
  id: string;
  name: string;
  free: string;
  premium: string;
  /** Short hook under the modal title */
  tagline: string;
  /** Rich explanation; supports \n\n for paragraph breaks */
  body: string;
};

export const PRICING_FEATURES: PricingFeatureDetail[] = [
  {
    id: "account-extension",
    name: "Account, web dashboard & browser extension",
    free: "Yes",
    premium: "Yes",
    tagline: "One login everywhere — track in the browser and review on the web.",
    body: `Create a Recount account and use the same email and password in the Chrome-family extension and on this website. The dashboard is where you see longer views, settings, exports, and (with Lifetime) AI reports.

What you can do: sign up free, install the extension, open Dashboard from the toolbar, and jump to Reports, Activity, History, Team, or Settings without paying.

The extension handles passive recording; the web app handles analysis, privacy controls, and billing. Nothing requires both to be open at once — data syncs when the extension uploads events to the API.`,
  },
  {
    id: "tab-tracking",
    name: "Passive tab time tracking (HTTP/HTTPS pages)",
    free: "Yes",
    premium: "Yes",
    tagline: "See where your browser time actually goes — without starting a timer manually.",
    body: `After you grant site access, Recount records time spent on active tabs on ordinary websites (http and https). It skips browser internals, file URLs, and localhost so dev noise stays out.

Each stretch of focus on a tab becomes a segment with a domain, optional page title (if you allow it), start/end times, and an automatic category.

What you can do: work normally; open the extension or dashboard to see today’s totals and top sites. Segments flush periodically so you don’t lose data if the browser closes.`,
  },
  {
    id: "blocklist",
    name: "Extension: domain blocklist (never record those sites)",
    free: "Yes",
    premium: "Yes",
    tagline: "Exclude sensitive or irrelevant sites from tracking entirely.",
    body: `List hostnames (one per line) that should never be tracked — for example banking or health portals. You can edit the list in **Dashboard → Settings → Features → Never track** (saved on your profile) or in the extension **Options** page. The extension applies the profile copy when it syncs your settings.

Matching uses the site hostname (subdomains count, same as the extension).

Blocked sites don’t create tab events at all, so they won’t appear in Activity, exports, or AI reports.

What you can do: add or remove domains anytime; after saving on the web, reload or wait for extension sync so new activity respects the list.`,
  },
  {
    id: "intentions",
    name: "Daily intentions (extension popup & web)",
    free: "Yes",
    premium: "Yes",
    tagline: "Write what you plan to do today — Recount compares it to your real tabs.",
    body: `Intentions are simple text goals for a calendar day (stored in UTC). You can set them from the **extension popup** or **edit today’s goals on the dashboard** (same API as the extension — one goal per line).

They power honest check-ins: the AI report (Lifetime) weighs your goals against where time actually went. Intent lock uses the same goals to decide when to nudge you on distraction sites.

What you can do: add several goals, save from either place, and clear a day by saving an empty list from the dashboard. Streaks only count days where you have at least one non-empty goal.`,
  },
  {
    id: "overview",
    name: "Dashboard overview (today’s tracked time, top domains, intentions)",
    free: "Yes",
    premium: "Yes",
    tagline: "Your at-a-glance view for “today” in UTC.",
    body: `The main dashboard shows today’s date in UTC, total tracked minutes, your top domains, and the list of intentions you saved for that day.

Lifetime users also see the AI accountability card for today once a report exists.

What you can do: confirm you’re tracking, spot drift early, and jump to Reports or Activity for depth.`,
  },
  {
    id: "streaks",
    name: "Intention & tracking streaks (dashboard & extension)",
    free: "Yes",
    premium: "Yes",
    tagline: "Two streaks: showing up with goals, and showing up with measurable focus.",
    body: `Recount tracks two streaks, both counted in UTC days from today backward. The intention streak is consecutive days where you saved at least one non-empty goal. The tracking streak is consecutive days where you logged at least a few minutes of tab time (threshold is shown in the UI).

They’re independent: you can have a tracking streak without intentions or vice versa.

What you can do: check the dashboard card and the extension popup for motivation — no extra setup beyond using goals and tracking normally.`,
  },
  {
    id: "pomodoro",
    name: "Pomodoro / focus timer in extension (tags uploaded segments)",
    free: "Yes",
    premium: "Yes",
    tagline: "Optional focus sessions that label your tab events for later analysis.",
    body: `From the extension popup you can start a short focus timer (e.g. 25 minutes). While it runs, tab segments uploaded to the server include a shared session id so you can group “this block was one focus sprint” in your data.

When the timer ends you get a notification; stopping early clears the tag for new segments.

What you can do: start/stop from the popup; combine with Activity filters later to reason about deep-work blocks (session id is stored on each event).`,
  },
  {
    id: "intent-lock",
    name: "Intent lock & distraction list (settings → extension sync)",
    free: "Yes",
    premium: "Yes",
    tagline: "Gentle nudges when you visit sites you said pull you off track.",
    body: `In **Settings → Features** on the web, pick distraction sites (preset multiselect and/or custom hostnames) and turn on intent lock. The signed-in extension pulls these prefs periodically and caches them locally.

If intent lock is on, you have goals for today, and you focus a tab on a distraction domain, Recount can show a system notification and a small in-page banner (once per domain per UTC day).

What you can do: curate your distraction list in Settings, save, reload the extension if needed, and keep intentions updated — nudges never block sites; they only remind you.`,
  },
  {
    id: "privacy-titles",
    name: "Privacy: send tab titles or domains-only (setting)",
    free: "Yes",
    premium: "Yes",
    tagline: "Choose whether page titles leave your browser.",
    body: `By default the extension sends both domain and tab title with each segment. In **Settings → Features**, use the **Activity detail** control to choose domains-only vs including page titles — better for privacy, less context in Activity and reports.

The extension reads this preference from your profile when it syncs settings.

What you can do: slide to **domains and time only** if you prefer minimal data; include titles when you want richer history.`,
  },
  {
    id: "profile-settings",
    name: "Profile settings (timezone, hourly rate, team slug, etc.)",
    free: "Yes",
    premium: "Yes",
    tagline: "Central place for prefs that follow your account.",
    body: `Settings saves through the API to your profile: timezone, optional hourly rate (for your own sense of value — not billing), **never-track blocklist**, distraction list for intent lock, digest opt-in, team leaderboard fields, and privacy toggles.

Exports and calendar feeds use your plan to decide default date ranges.

What you can do: keep timezone accurate for how you think about “today,” set a team slug to match colleagues, opt into the digest if your operator runs it, and download CSV/ICS from the same page.`,
  },
  {
    id: "team-leaderboard",
    name: "Team leaderboard (shared slug, opt-in nickname)",
    free: "Yes",
    premium: "Yes",
    tagline: "Optional friendly comparison of tracked minutes within a group.",
    body: `Anyone can set a **team slug** (same string as teammates) and optionally opt in with a **nickname**. The Team page ranks opted-in members by tracked minutes for the current UTC week.

Others never see your email — only nickname and minutes.

What you can do: agree on a slug with your group, pick a display name, opt in to appear, or stay off the board while still using the same slug for future use.`,
  },
  {
    id: "weekly-digest",
    name: "Weekly digest email (opt-in in settings)",
    free: "Yes — if your host runs the digest job & email (not tied to license)",
    premium: "Same",
    tagline: "Optional email summary of last week — when the server is configured to send it.",
    body: `The toggle in Settings marks your account as wanting a digest. Actually receiving mail depends on whoever runs Recount’s API scheduling **POST /api/jobs/weekly-digest** with a secret, plus a working email provider (e.g. Resend).

The digest summarizes the previous UTC week: tracked time, rough breakdown, and how many days had intentions.

What you can do: opt in if your deployment supports it; self-hosters wire cron + env vars. This is not unlocked by Lifetime — it’s infrastructure-dependent.`,
  },
  {
    id: "eod-reminder",
    name: "Extension: end-of-day reminder",
    free: "Yes",
    premium: "Yes",
    tagline: "A nudge to review your day before you disconnect.",
    body: `The extension schedules a local alarm (default around 6 p.m. local time) to remind you to check in. If you’re on a normal web page it may inject a small banner; otherwise you may get a notification.

It respects the same site-access permission as tracking.

What you can do: treat it as a cue to open Recount, skim intentions vs. domains, or generate a report if you’re on Lifetime.`,
  },
  {
    id: "activity",
    name: "Activity page (filters, analytics, delete your own rows)",
    free: "Last 7 UTC days of data",
    premium: "Full history",
    tagline: "Deep dive into individual tab segments and rollups.",
    body: `Activity shows filtered lists of your tab events, aggregate stats (totals, top domains, categories), and optional delete for your own rows. You can filter by date range, domain substring, category, minimum duration, and sort order.

On **Free**, the API only returns the last **seven UTC days** of data. **Lifetime** removes that cap so you can explore your full archive.

What you can do: audit a week, find long sessions, clean up mistaken segments, or export context for coaching — scope grows with Lifetime.`,
  },
  {
    id: "per-day-summary",
    name: "Per-day summary API (reports, extension “today”, etc.)",
    free: "Last 7 UTC calendar days",
    premium: "Any day you have data for",
    tagline: "The daily roll-up of minutes per domain behind much of the UI.",
    body: `Many surfaces ask for “all domains and minutes for date D.” Free accounts may only query dates within the last seven UTC calendar days from today; Lifetime can query older days (subject to your actual data).

The extension’s “today” preview and dashboard tiles use this same summary shape.

What you can do: on Free, rely on the last week for quick checks; on Lifetime, open any past day you’ve tracked for consistent summaries.`,
  },
  {
    id: "history-chart",
    name: "History chart (dashboard)",
    free: "Last 7 days",
    premium: "Last 14 days",
    tagline: "A simple bar chart of total tracked minutes per day.",
    body: `The History page charts total active minutes per day for a short rolling window. **Free** shows **7** days; **Lifetime** extends the chart to **14** days.

It’s a lightweight trend view — for segment-level detail use Activity.

What you can do: spot streaks or slumps at a glance; pair with intentions and reports for weekly reviews.`,
  },
  {
    id: "csv-export",
    name: "CSV export (Settings)",
    free: "7 days of daily totals",
    premium: "30 days",
    tagline: "Download per-day domain totals as a spreadsheet.",
    body: `From Settings, **Download CSV** builds rows of date, domain, minutes, and category by calling the daily summary endpoint for each day in a window. **Free** pulls **7** days; **Lifetime** pulls **30**.

Use it in Excel, Sheets, or scripts for custom charts.

What you can do: archive a month of rollups on Lifetime, or a week on Free, without touching the API yourself.`,
  },
  {
    id: "ics-export",
    name: "Calendar (.ics) export (Settings)",
    free: "~7-day default window",
    premium: "~30-day default; up to about 1 year of daily events",
    tagline: "Subscribe to “how much I tracked each day” in your calendar app.",
    body: `The ICS file contains one all-day-style event per day that had tracked time, with a summary like “Recount: Xm tracked.” Default ranges mirror CSV: about **7** days on Free and **30** on Lifetime, with Lifetime allowing a much wider span (on the order of a year) if you adjust query parameters in advanced setups.

Import the file into Google Calendar, Apple Calendar, etc.

What you can do: see tracking volume alongside meetings; Lifetime users get more history in one file.`,
  },
  {
    id: "ai-reports",
    name: "AI accountability reports (generate, history, detail pages)",
    free: "No",
    premium: "Yes (e.g. GPT-4o–powered summary & score)",
    tagline: "A written review of your day against your intentions — Pro only.",
    body: `Lifetime unlocks **Reports**: generate an AI summary for a given day that considers your intentions and domain mix, assigns an optional score, and stores goals met/missed. You can browse past reports and open any day’s full text.

Generation calls the configured AI model (e.g. GPT-4o) on the server; Free accounts cannot run or view these endpoints.

What you can do: after a workday, click generate, read the narrative, and iterate the next day’s intentions based on honest feedback.`,
  },
];
