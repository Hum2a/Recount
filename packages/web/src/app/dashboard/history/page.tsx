import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { HistoryCharts } from "./history-charts";

function pastDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const payRes = await apiFetch("/api/payments/status", session.access_token);
  const pay = await payRes.json().catch(() => ({}));
  const licensed = Boolean(pay.data?.license_active);
  const days = licensed ? 14 : 7;

  const dates = pastDays(days);
  const rows: { date: string; minutes: number }[] = [];

  for (const date of dates) {
    const res = await apiFetch(`/api/events/summary?date=${date}`, session.access_token);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) continue;
    const sec = body.data?.total_active_sec ?? 0;
    rows.push({ date, minutes: Math.round(sec / 60) });
  }

  rows.reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="mt-1 text-sm text-muted">
          {licensed ? "Last 14 days of tracked active time." : "Free plan: last 7 days."}
        </p>
      </div>
      <section className="rounded-xl bg-card p-6 ring-1 ring-white/10">
        <HistoryCharts data={rows} />
      </section>
    </div>
  );
}
