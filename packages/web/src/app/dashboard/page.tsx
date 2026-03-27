import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";
import { hasFullProductAccess } from "@/lib/entitlements";
import { AnimatedCard } from "@/components/motion/animated-card";
import { GenerateReportButton } from "./generate-report-button";
import { UpgradeCard } from "./upgrade-card";
import { TodayIntentionsEditor } from "./today-intentions-editor";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const token = session.access_token;
  const date = todayUtc();

  const [payRes, sumRes, intRes, streakRes] = await Promise.all([
    apiFetch("/api/payments/status", token),
    apiFetch(`/api/events/summary?date=${date}`, token),
    apiFetch(`/api/intentions/${date}`, token),
    apiFetch("/api/profiles/me/streaks", token),
  ]);

  const pay = await payRes.json().catch(() => ({}));
  const summary = await sumRes.json().catch(() => ({}));
  const intention = await intRes.json().catch(() => ({}));
  const streakBody = await streakRes.json().catch(() => ({}));

  const licensed = hasFullProductAccess(Boolean(pay.data?.license_active), pay.data?.app_role as string | undefined);
  let report: unknown = null;
  if (licensed) {
    const repRes = await apiFetch(`/api/reports/${date}`, token);
    report = await repRes.json().catch(() => ({}));
  }

  const domains = summary.data?.domains ?? [];
  const top = domains.slice(0, 5);
  const minutes = Math.round((summary.data?.total_active_sec ?? 0) / 60);
  const streaks = streakBody.data as
    | { intention_streak?: number; tracking_streak?: number; tracking_min_sec_per_day?: number }
    | undefined;

  return (
    <div className="space-y-8">
      {!licensed && (
        <AnimatedCard>
          <UpgradeCard />
        </AnimatedCard>
      )}
      {streaks && (
        <AnimatedCard className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
          <h2 className="text-lg font-medium">Streaks (UTC)</h2>
          <p className="mt-2 text-sm text-muted">
            Intentions:{" "}
            <span className="font-mono text-foreground">{streaks.intention_streak ?? 0}</span> consecutive day(s) with
            goals · Tracking:{" "}
            <span className="font-mono text-foreground">{streaks.tracking_streak ?? 0}</span> day(s) with at least{" "}
            {Math.round((streaks.tracking_min_sec_per_day ?? 300) / 60)} minutes recorded.
          </p>
        </AnimatedCard>
      )}
      <AnimatedCard delay={0.04} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <h2 className="text-lg font-medium">Today ({date})</h2>
        <p className="mt-2 text-sm text-muted">
          Active browser time (tracked): <span className="text-foreground font-mono">{minutes} min</span>
        </p>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-muted">Intentions</h3>
          <ul className="mt-2 list-inside list-disc text-sm">
            {(intention.data?.goals ?? []).length ? (
              intention.data.goals.map((g: string, i: number) => <li key={`${i}-${g.slice(0, 32)}`}>{g}</li>)
            ) : (
              <li className="text-muted">None set yet — add below or in the extension popup.</li>
            )}
          </ul>
          <TodayIntentionsEditor date={date} initialGoals={(intention.data?.goals ?? []) as string[]} />
        </div>
      </AnimatedCard>
      <AnimatedCard delay={0.08} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
        <h2 className="text-lg font-medium">Top domains</h2>
        <ul className="mt-4 space-y-2 font-mono text-sm">
          {top.length === 0 && <li className="text-muted">No events yet for today.</li>}
          {top.map((d: { domain: string; seconds: number; category: string }) => (
            <li key={d.domain} className="flex justify-between gap-4">
              <span>{d.domain}</span>
              <span className="text-muted">
                {Math.round(d.seconds / 60)} min · {d.category}
              </span>
            </li>
          ))}
        </ul>
      </AnimatedCard>
      {licensed && (
        <AnimatedCard delay={0.12} className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-medium">AI accountability</h2>
            <GenerateReportButton date={date} />
          </div>
          {report && typeof report === "object" && report !== null && "data" in report && report.data ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-muted">
                Score:{" "}
                <span className="font-mono text-foreground">{(report.data as { score?: number }).score ?? "—"}</span>
                /10
              </p>
              <p className="leading-relaxed whitespace-pre-wrap">
                {(report.data as { ai_summary?: string }).ai_summary}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No report for today yet. Generate one when you are ready.</p>
          )}
        </AnimatedCard>
      )}
    </div>
  );
}
