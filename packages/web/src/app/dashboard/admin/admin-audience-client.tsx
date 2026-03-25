"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "./admin-fetch";

type DomainRow = { domain: string; total_duration_sec: number; distinct_users: number };

type AudiencePayload = {
  generated_at?: string;
  profiles?: { total?: number; licensed?: number; with_any_demographic?: number };
  countries?: { code: string; count: number }[];
  birth_years?: { year: number; count: number }[];
  company_size?: { size: string; count: number }[];
  industries_top?: { label: string; count: number }[];
  occupations_top?: { label: string; count: number }[];
  referral_sources_top?: { label: string; count: number }[];
  primary_use_cases_top?: { label: string; count: number }[];
  logins?: { last_7d?: number; last_30d?: number; unique_users_30d?: number };
  domain_trends_30d_utc?: DomainRow[];
};

function formatSec(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AdminAudienceClient() {
  const [data, setData] = useState<AudiencePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await adminApi("/api/admin/analytics/audience");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof body.error === "string" ? body.error : "Could not load analytics.");
        setData(null);
        return;
      }
      setData((body.data as AudiencePayload) ?? {});
    } catch {
      setErr("Could not load analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const p = data?.profiles;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audience analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Aggregates from profiles, optional survey fields, login events, and tracked domains (last 30 days, UTC
            dates). Use this to understand who signs up and where time is spent across the product.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/admin"
            className="text-sm font-medium text-accent hover:underline"
          >
            ← Staff directory
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm text-foreground hover:bg-white/[0.1]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {err && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{err}</p>
      )}

      {!loading && !err && data && (
        <>
          {data.generated_at && (
            <p className="text-xs text-muted">
              Generated {new Date(data.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-card/60 p-4 ring-1 ring-white/10">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Accounts</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{p?.total ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/60 p-4 ring-1 ring-white/10">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Licensed</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{p?.licensed ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/60 p-4 ring-1 ring-white/10">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Survey / profile detail</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{p?.with_any_demographic ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Users who filled at least one optional field</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/60 p-4 ring-1 ring-white/10">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Logins (30d)</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{data.logins?.last_30d ?? 0}</p>
              <p className="mt-1 text-xs text-muted">
                Unique users (30d): {data.logins?.unique_users_30d ?? 0} · 7d: {data.logins?.last_7d ?? 0}
              </p>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <RankedList title="Country (ISO code)" rows={(data.countries ?? []).map((r) => ({ label: r.code ?? "—", count: r.count }))} />
            <RankedList title="Company size" rows={(data.company_size ?? []).map((r) => ({ label: r.size ?? "—", count: r.count }))} />
            <RankedList title="Birth year cohort" rows={(data.birth_years ?? []).map((r) => ({ label: String(r.year), count: r.count }))} />
            <RankedList title="How they heard about us" rows={(data.referral_sources_top ?? []).map((r) => ({ label: r.label ?? "—", count: r.count }))} />
            <RankedList title="Industry (top mentions)" rows={(data.industries_top ?? []).map((r) => ({ label: r.label ?? "—", count: r.count }))} />
            <RankedList title="Occupation" rows={(data.occupations_top ?? []).map((r) => ({ label: r.label ?? "—", count: r.count }))} />
            <RankedList
              title="Primary use case"
              rows={(data.primary_use_cases_top ?? []).map((r) => ({ label: r.label ?? "—", count: r.count }))}
              className="lg:col-span-2"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Domains by tracked time (30d UTC)</h2>
            <p className="text-sm text-muted">
              Sum of completed segment duration across all users. Useful to see which sites dominate aggregate attention.
            </p>
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium">Total time</th>
                    <th className="px-3 py-2 font-medium">Active users</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.domain_trends_30d_utc ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-muted">
                        No activity in this window.
                      </td>
                    </tr>
                  )}
                  {(data.domain_trends_30d_utc ?? []).map((row) => (
                    <tr key={row.domain} className="border-b border-white/5">
                      <td className="px-3 py-2 font-mono text-xs text-foreground">{row.domain}</td>
                      <td className="px-3 py-2 text-muted">{formatSec(Number(row.total_duration_sec))}</td>
                      <td className="px-3 py-2 text-muted">{row.distinct_users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function RankedList({
  title,
  rows,
  className,
}: {
  title: string;
  rows: { label: string; count: number }[];
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className={className}>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r, i) => (
            <li key={`${title}-${i}-${r.label}`} className="flex items-center gap-2 text-sm">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-white/35"
                  style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                />
              </div>
              <span className="w-28 shrink-0 truncate text-right text-muted">{r.label}</span>
              <span className="w-10 shrink-0 text-right font-medium text-foreground">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
