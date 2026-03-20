"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function SettingsPage() {
  const [hourly, setHourly] = useState("0");
  const [tz, setTz] = useState("UTC");
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
      const row = body.data as {
        hourly_rate?: number;
        timezone?: string;
        license_active?: boolean;
        app_role?: string;
      };
      setHourly(String(row.hourly_rate ?? 0));
      setTz(row.timezone ?? "UTC");
      setLicensed(Boolean(row.license_active));
      setAppRole(typeof row.app_role === "string" ? row.app_role : "user");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setMsg(null);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMsg("Sign in again.");
      return;
    }
    const res = await fetch(`${apiUrl}/api/profiles`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        hourly_rate: Number(hourly) || 0,
        timezone: tz,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok ? "Saved." : (body.error ?? "Could not save"));
  }

  async function exportCsv() {
    setMsg(null);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
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
      <Button onClick={saveProfile}>Save settings</Button>
      <div className="border-t border-white/10 pt-6">
        <h2 className="text-lg font-medium">Export</h2>
        <p className="mt-1 text-sm text-muted">
          CSV of domain totals per day ({licensed ? "30" : "7"} days).
        </p>
        <Button variant="secondary" className="mt-3" onClick={exportCsv}>
          Download CSV
        </Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
