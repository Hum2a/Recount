import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { hasFullProductAccess } from "@/lib/entitlements";
import { UpgradeCard } from "../upgrade-card";
import { GenerateReportButton } from "../generate-report-button";
import { AnimatedCard } from "@/components/motion/animated-card";
import { ReportsHistory } from "./reports-history";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

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

  const today = todayUtc();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">AI reports</h1>
        <AnimatedCard className="rounded-xl bg-card/80 px-4 py-3 ring-1 ring-white/10">
          <p className="text-xs text-muted">Quick action · UTC day {today}</p>
          <div className="mt-2">
            <GenerateReportButton date={today} variant="compact" />
          </div>
        </AnimatedCard>
      </div>
      <ReportsHistory rows={rows} />
    </div>
  );
}
