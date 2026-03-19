import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { apiFetch } from "@/lib/api";

type Props = { params: { date: string } };

export default async function ReportDetailPage({ params }: Props) {
  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const payRes = await apiFetch("/api/payments/status", session.access_token);
  const pay = await payRes.json().catch(() => ({}));
  if (!pay.data?.license_active) redirect("/dashboard/reports");

  const repRes = await apiFetch(`/api/reports/${date}`, session.access_token);
  const rep = await repRes.json().catch(() => ({}));
  if (!rep.data) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/reports" className="text-sm text-muted hover:text-foreground">
          ← Back
        </Link>
        <p className="text-sm text-muted">No report for this date.</p>
      </div>
    );
  }

  const r = rep.data as {
    ai_summary: string;
    score: number;
    top_domains: { domain: string; seconds: number; category: string }[];
    goals_met: string[];
    goals_missed: string[];
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/reports" className="text-sm text-muted hover:text-foreground">
        ← All reports
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">{date}</h1>
        <p className="mt-1 font-mono text-sm text-muted">Score {r.score}/10</p>
      </header>
      <section className="rounded-xl bg-card p-6 ring-1 ring-white/10">
        <h2 className="text-sm font-medium text-muted">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed">{r.ai_summary}</p>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-card p-6 ring-1 ring-white/10">
          <h3 className="text-sm font-medium text-muted">Goals met</h3>
          <ul className="mt-2 list-inside list-disc text-sm">
            {(r.goals_met ?? []).map((g) => (
              <li key={g}>{g}</li>
            ))}
            {(r.goals_met ?? []).length === 0 && <li className="text-muted">—</li>}
          </ul>
        </div>
        <div className="rounded-xl bg-card p-6 ring-1 ring-white/10">
          <h3 className="text-sm font-medium text-muted">Goals missed</h3>
          <ul className="mt-2 list-inside list-disc text-sm">
            {(r.goals_missed ?? []).map((g) => (
              <li key={g}>{g}</li>
            ))}
            {(r.goals_missed ?? []).length === 0 && <li className="text-muted">—</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
