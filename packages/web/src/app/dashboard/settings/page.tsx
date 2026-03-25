"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ProfileRow = {
  hourly_rate?: number;
  timezone?: string;
  license_active?: boolean;
  app_role?: string;
  distraction_domains?: string[];
  intent_lock_enabled?: boolean;
  weekly_digest_enabled?: boolean;
  send_tab_titles?: boolean;
  team_slug?: string | null;
  leaderboard_opt_in?: boolean;
  leaderboard_nickname?: string | null;
};

export default function SettingsPage() {
  const [hourly, setHourly] = useState("0");
  const [tz, setTz] = useState("UTC");
  const [distractionText, setDistractionText] = useState("");
  const [intentLock, setIntentLock] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [sendTitles, setSendTitles] = useState(true);
  const [teamSlug, setTeamSlug] = useState("");
  const [leaderOptIn, setLeaderOptIn] = useState(false);
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [appRole, setAppRole] = useState<string>("user");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token || cancelled) return;
      const res = await fetch(`${apiUrl}/api/profiles/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (cancelled || !body.data) return;
      const row = body.data as ProfileRow;
      setHourly(String(row.hourly_rate ?? 0));
      setTz(row.timezone ?? "UTC");
      setLicensed(Boolean(row.license_active));
      setAppRole(typeof row.app_role === "string" ? row.app_role : "user");
      setDistractionText(Array.isArray(row.distraction_domains) ? row.distraction_domains.join("\n") : "");
      setIntentLock(Boolean(row.intent_lock_enabled));
      setWeeklyDigest(Boolean(row.weekly_digest_enabled));
      setSendTitles(row.send_tab_titles !== false);
      setTeamSlug(row.team_slug ?? "");
      setLeaderOptIn(Boolean(row.leaderboard_opt_in));
      setNickname(row.leaderboard_nickname ?? "");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function getToken() {
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  }

  async function saveProfile() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const distraction_domains = distractionText
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean);
    const res = await fetch(`${apiUrl}/api/profiles`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hourly_rate: Number(hourly) || 0,
        timezone: tz,
        distraction_domains,
        intent_lock_enabled: intentLock,
        weekly_digest_enabled: weeklyDigest,
        send_tab_titles: sendTitles,
        team_slug: teamSlug.trim() || null,
        leaderboard_opt_in: leaderOptIn,
        leaderboard_nickname: nickname.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved. Reload the browser extension if it is open so intent-lock prefs sync." : (body.error ?? "Could not save"));
  }

  async function exportCsv() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const days = licensed ? 30 : 7;
    const lines = ["date,domain,minutes,category"];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const res = await fetch(`${apiUrl}/api/events/summary?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) continue;
      for (const dom of body.data?.domains ?? []) {
        lines.push(
          `${date},${dom.domain},${Math.round(dom.seconds / 60)},${dom.category ?? ""}`
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recount-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadIcs() {
    setMsg(null);
    const token = await getToken();
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const res = await fetch(`${apiUrl}/api/events/me/calendar.ics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMsg(err.error ?? "Could not download calendar.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recount-activity.ics";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Calendar file downloaded.");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Saved via the Recount API (synced to your profile).</p>
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-foreground">Plan:</span>{" "}
          {licensed ? "Premium (license active)" : "Free"}
          {" · "}
          <span className="font-medium text-foreground">Role:</span> {appRole}
        </p>
      </div>
      <label className="block text-sm text-muted">
        Hourly rate (£)
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
          type="number"
          min={0}
          step="0.01"
          value={hourly}
          onChange={(e) => setHourly(e.target.value)}
        />
      </label>
      <label className="block text-sm text-muted">
        Timezone (IANA, e.g. Europe/London)
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        />
      </label>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Focus &amp; intent lock</h2>
        <p className="text-sm text-muted">
          Distraction hostnames (one per line, no <code className="text-foreground/80">https://</code>). When intent lock
          is on and you have goals for today, the extension nudges you on these sites. Reload the extension after saving.
        </p>
        <label className="block text-sm text-muted">
          Distraction domains
          <textarea
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 font-mono text-sm text-foreground"
            rows={5}
            value={distractionText}
            onChange={(e) => setDistractionText(e.target.value)}
            placeholder={"youtube.com\nreddit.com"}
          />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={intentLock} onChange={(e) => setIntentLock(e.target.checked)} />
          <span>Enable intent lock nudges (extension must be signed in)</span>
        </label>
      </div>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Privacy &amp; email</h2>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={sendTitles} onChange={(e) => setSendTitles(e.target.checked)} />
          <span>Send page titles with tab events (uncheck to record domains and time only)</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={weeklyDigest}
            onChange={(e) => setWeeklyDigest(e.target.checked)}
          />
          <span>Weekly digest email (previous UTC week; requires Resend + cron calling the digest job)</span>
        </label>
      </div>
      <div className="border-t border-white/10 pt-6 space-y-4">
        <h2 className="text-lg font-medium">Team leaderboard</h2>
        <p className="text-sm text-muted">
          Use the same team slug as colleagues (lowercase letters, numbers, hyphens). Opt in to appear on the board with a
          display nickname.
        </p>
        <label className="block text-sm text-muted">
          Team slug
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            value={teamSlug}
            onChange={(e) => setTeamSlug(e.target.value.toLowerCase())}
            placeholder="acme-design"
          />
        </label>
        <label className="block text-sm text-muted">
          Leaderboard nickname
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={80}
            placeholder="Alex"
          />
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1" checked={leaderOptIn} onChange={(e) => setLeaderOptIn(e.target.checked)} />
          <span>Show me on the team leaderboard (this UTC week&apos;s tracked minutes)</span>
        </label>
      </div>
      <Button onClick={saveProfile}>Save settings</Button>
      <div className="border-t border-white/10 pt-6">
        <h2 className="text-lg font-medium">Export</h2>
        <p className="mt-1 text-sm text-muted">
          CSV of domain totals per day ({licensed ? "30" : "7"} days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={exportCsv}>
          Download CSV
        </Button>
        <p className="mt-4 text-sm text-muted">
          Subscribe in Google Calendar or Apple Calendar with the ICS feed (default range: {licensed ? "30" : "7"} UTC
          days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={downloadIcs}>
          Download ICS
        </Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
