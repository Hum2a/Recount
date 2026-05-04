"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ReportRow = {
  id: string;
  date: string;
  score: number | null;
  ai_summary: string;
};

type Props = {
  rows: ReportRow[];
};

function uniqueMonths(rows: ReportRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) set.add(r.date.slice(0, 7));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function ReportsHistory({ rows }: Props) {
  const [month, setMonth] = useState<string>("");
  const [query, setQuery] = useState("");

  const months = useMemo(() => uniqueMonths(rows), [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (month) list = list.filter((r) => r.date.startsWith(month));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => r.date.includes(q) || (r.ai_summary ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, month, query]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No reports yet</p>
        <p className="mt-2 text-sm text-muted">
          Generate your first report from the quick action above or open a day from Activity after you&apos;ve tracked
          time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[10rem] flex-col gap-1 text-xs text-muted">
          Month (UTC)
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 flex-col gap-1 text-xs text-muted sm:max-w-md">
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Date or words in the summary…"
            className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No reports match these filters.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((r) => (
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
      )}
    </div>
  );
}
