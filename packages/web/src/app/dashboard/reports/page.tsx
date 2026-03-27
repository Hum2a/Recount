import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { hasFullProductAccess } from "@/lib/entitlements";
import { UpgradeCard } from "../upgrade-card";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const payRes = await apiFetch("/api/payments/status", session.access_token);
  const pay = await payRes.json().catch(() => ({}));
  const licensed = hasFullProductAccess(Boolean(pay.data?.license_active), pay.data?.app_role as string | undefined);

  if (!licensed) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted">AI reports need an active license or staff access (admin/developer).</p>
        <UpgradeCard />
      </div>
    );
  }

  const histRes = await apiFetch("/api/reports/history", session.access_token);
  const hist = await histRes.json().catch(() => ({}));
  const rows = hist.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI reports</h1>
      <ul className="space-y-4">
        {rows.length === 0 && <li className="text-sm text-muted">No reports yet.</li>}
        {rows.map((r: { id: string; date: string; score: number | null; ai_summary: string }) => (
          <li key={r.id} className="rounded-xl bg-card p-4 ring-1 ring-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/dashboard/reports/${r.date}`} className="font-medium hover:underline">
                {r.date}
              </Link>
              <span className="font-mono text-sm text-muted">{r.score ?? "—"}/10</span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-muted">{r.ai_summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
