"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type TabEvent = {
  id: string;
  domain: string;
  title: string | null;
  start_time: string;
  end_time: string | null;
  duration_sec: number | null;
  category: string | null;
  date: string;
};

type ActivitySummary = {
  event_count: number;
  total_duration_sec: number;
  completed_duration_rows: number;
  distinct_days: number;
  avg_duration_sec: number | null;
  top_domains: { domain: string; duration_sec: number }[];
  categories: string[];
  stats_incomplete?: boolean;
};

export type ActivityExplorerProps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  buildSummaryPath: (filterParams: URLSearchParams) => string;
  buildSegmentsPath: (listParams: URLSearchParams) => string;
  buildDeletePath: (eventId: string) => string;
  canDelete: boolean;
  /** Free plan: explain 7-day window */
  freeTierLimited?: boolean;
  onDataChanged?: () => void;
  intro: React.ReactNode;
  /** Staff view: hint about DB migration for huge accounts */
  showMigrationHint?: boolean;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

const limit = 40;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "start_time_desc", label: "Start time · newest first" },
  { value: "start_time_asc", label: "Start time · oldest first" },
  { value: "duration_desc", label: "Duration · longest first" },
  { value: "duration_asc", label: "Duration · shortest first" },
  { value: "domain_asc", label: "Domain · A → Z" },
  { value: "domain_desc", label: "Domain · Z → A" },
  { value: "date_desc", label: "Calendar day · newest first" },
  { value: "date_asc", label: "Calendar day · oldest first" },
];

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(sec: number) {
  const n = typeof sec === "string" ? Number(sec) : sec;
  if (!Number.isFinite(n) || n <= 0) return "0 min";
  if (n < 60) return `${Math.round(n)}s`;
  const m = Math.floor(n / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setD(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return d;
}

export function ActivityExplorer({
  apiFetch,
  buildSummaryPath,
  buildSegmentsPath,
  buildDeletePath,
  canDelete,
  freeTierLimited = false,
  onDataChanged,
  intro,
  showMigrationHint = false,
}: ActivityExplorerProps) {
  const [rows, setRows] = useState<TabEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const debouncedDomain = useDebounced(domainInput, 320);
  const [category, setCategory] = useState("");
  const [minMinutes, setMinMinutes] = useState("");
  const [sort, setSort] = useState("start_time_desc");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (debouncedDomain.trim()) p.set("domain", debouncedDomain.trim());
    if (category) p.set("category", category);
    const mm = minMinutes.trim();
    if (mm !== "") {
      const n = Number.parseInt(mm, 10);
      if (Number.isFinite(n) && n > 0) p.set("min_duration_sec", String(n * 60));
    }
    return p;
  }, [from, to, debouncedDomain, category, minMinutes]);

  const listParamsBase = useMemo(() => {
    const p = new URLSearchParams(filterParams);
    p.set("sort", sort);
    return p;
  }, [filterParams, sort]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiFetch(buildSummaryPath(filterParams));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSummaryError(typeof body.error === "string" ? body.error : "Could not load analytics.");
        setSummary(null);
        return;
      }
      const data = body.data as ActivitySummary | undefined;
      setSummary(data ?? null);
    } catch {
      setSummaryError("Could not load analytics.");
      setSummary(null);
    }
    setSummaryLoading(false);
  }, [apiFetch, buildSummaryPath, filterParams]);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const p = new URLSearchParams(listParamsBase);
      p.set("limit", String(limit));
      p.set("offset", String(offset));
      const res = await apiFetch(buildSegmentsPath(p));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load activity.");
        return;
      }
      const data = body.data as { tab_events?: TabEvent[]; total?: number } | undefined;
      const list = data?.tab_events ?? [];
      setTotal(data?.total ?? 0);
      setError(null);
      if (append) setRows((prev) => [...prev, ...list]);
      else setRows(list);
    },
    [apiFetch, buildSegmentsPath, listParamsBase]
  );

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchPage(0, false);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (rows.length >= total || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(rows.length, true);
    setLoadingMore(false);
  }

  async function remove(id: string) {
    if (!canDelete || !confirm("Delete this activity row? This cannot be undone.")) return;
    try {
      const res = await apiFetch(buildDeletePath(id), { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Could not delete.");
        return;
      }
      onDataChanged?.();
      setLoading(true);
      await Promise.all([fetchPage(0, false), fetchSummary()]);
      setLoading(false);
    } catch {
      setError("Could not delete.");
    }
  }

  const hasMore = rows.length < total;
  const maxTopSec = useMemo(() => {
    const t = summary?.top_domains ?? [];
    return t.reduce((m, x) => Math.max(m, Number(x.duration_sec) || 0), 0);
  }, [summary]);

  function clearFilters() {
    setFrom("");
    setTo("");
    setDomainInput("");
    setCategory("");
    setMinMinutes("");
    setSort("start_time_desc");
  }

  const totalDur = Number(summary?.total_duration_sec ?? 0);

  return (
    <div className="space-y-6">
      {freeTierLimited && (
        <p className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted">
          You&apos;re on the <span className="text-foreground font-medium">free plan</span>: this explorer includes the{" "}
          <span className="text-foreground font-medium">last 7 days</span> (UTC).{" "}
          <Link href="/pricing" className="font-medium text-accent hover:underline">
            Upgrade to Pro
          </Link>{" "}
          for your full history and other premium features.
        </p>
      )}

      <div className="text-sm text-muted">{intro}</div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          From
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          To
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-sm text-muted min-w-[140px] flex-1">
          Domain contains
          <input
            className={inputClass}
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="e.g. github"
          />
        </label>
        <label className="text-sm text-muted min-w-[160px]">
          Category
          <select
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={summaryLoading && !summary}
          >
            <option value="">All categories</option>
            {(summary?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted w-[120px]">
          Min minutes
          <input
            type="number"
            min={1}
            max={1440}
            className={inputClass}
            value={minMinutes}
            onChange={(e) => setMinMinutes(e.target.value)}
            placeholder="Any"
          />
        </label>
        <label className="text-sm text-muted min-w-[220px] flex-1">
          Sort table by
          <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" className="mt-6 shrink-0" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>

      {summaryError && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {summaryError}
        </p>
      )}

      {summaryLoading && !summary && <p className="text-sm text-muted">Loading analytics for this range…</p>}

      {summary && (
        <>
          {summary.stats_incomplete && showMigrationHint && (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              Analytics are from a sample of events (run migration{" "}
              <code className="text-foreground/90">006_admin_tab_event_summary.sql</code> in Supabase for full accuracy on
              very large accounts).
            </p>
          )}
          {summary.stats_incomplete && !showMigrationHint && (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              Totals may be approximate on very large accounts until your project runs the latest analytics migration.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Tracked time</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatDuration(Number(summary.total_duration_sec))}
              </p>
              <p className="mt-1 text-xs text-muted">Sum of completed segment lengths in this filter</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Segments</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {Number(summary.event_count).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted">Rows matching filters</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Active days</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{summary.distinct_days}</p>
              <p className="mt-1 text-xs text-muted">Distinct calendar days with activity</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Avg segment</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {summary.avg_duration_sec != null ? formatDuration(Number(summary.avg_duration_sec)) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">Among rows with a duration</p>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Top domains by time</h3>
              <span className="text-xs text-muted">Share of tracked time in this range</span>
            </div>
            {summary.top_domains.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No completed segments with duration in this range.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {summary.top_domains.map((t) => {
                  const dsec = Number(t.duration_sec) || 0;
                  const pct = maxTopSec > 0 ? Math.min(100, Math.round((dsec / maxTopSec) * 100)) : 0;
                  const share = totalDur > 0 ? Math.round((dsec / totalDur) * 100) : 0;
                  return (
                    <li key={t.domain}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">{t.domain || "(empty)"}</span>
                        <span className="shrink-0 text-muted">
                          {formatDuration(dsec)}
                          {share > 0 && <span className="text-muted/80"> · {share}% of total</span>}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-accent/85 transition-[width] duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {loading && <p className="text-sm text-muted">Loading table…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted">No activity rows match these filters.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Domain</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Start</th>
                {canDelete && <th className="px-2 py-2 font-medium"> </th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-2 py-2 align-top text-foreground">{r.date}</td>
                  <td className="px-2 py-2 align-top">
                    <div className="font-medium text-foreground">{r.domain}</div>
                    {r.title && <div className="max-w-[200px] truncate text-xs text-muted">{r.title}</div>}
                    {r.category && <div className="text-xs text-muted">{r.category}</div>}
                  </td>
                  <td className="px-2 py-2 align-top text-muted">
                    {r.duration_sec != null ? `${Math.round(r.duration_sec / 60)} min` : "—"}
                  </td>
                  <td className="px-2 py-2 align-top text-xs text-muted">{fmtTime(r.start_time)}</td>
                  {canDelete && (
                    <td className="px-2 py-2 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-300 hover:text-red-200"
                        onClick={() => void remove(r.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && !loading && (
        <Button type="button" variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
