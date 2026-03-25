"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldWithHint } from "@/components/ui/field-hint";
import { adminApi } from "./admin-fetch";

type Report = {
  id: string;
  user_id: string;
  date: string;
  ai_summary: string;
  score: number | null;
  top_domains: unknown;
  goals_met: string[] | null;
  goals_missed: string[] | null;
  generated_at: string;
};

type Props = {
  userId: string;
  canManage: boolean;
  onDataChanged: () => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

const limit = 30;

export function AdminUserReportsTab({ userId, canManage, onDataChanged }: Props) {
  const [rows, setRows] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Report | null>(null);
  const [summary, setSummary] = useState("");
  const [score, setScore] = useState("");
  const [topDomainsJson, setTopDomainsJson] = useState("");
  const [goalsMetText, setGoalsMetText] = useState("");
  const [goalsMissedText, setGoalsMissedText] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const res = await adminApi(`/api/admin/users/${userId}/reports?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load reports.");
        return;
      }
      const data = body.data as { reports?: Report[]; total?: number } | undefined;
      const list = data?.reports ?? [];
      setTotal(data?.total ?? 0);
      setError(null);
      if (append) setRows((prev) => [...prev, ...list]);
      else setRows(list);
    },
    [userId]
  );

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
  }, [userId, fetchPage]);

  async function loadMore() {
    if (rows.length >= total || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(rows.length, true);
    setLoadingMore(false);
  }

  function openEdit(r: Report) {
    setEditing(r);
    setSummary(r.ai_summary);
    setScore(r.score != null ? String(r.score) : "");
    try {
      setTopDomainsJson(
        r.top_domains == null ? "" : JSON.stringify(r.top_domains, null, 2)
      );
    } catch {
      setTopDomainsJson(String(r.top_domains));
    }
    setGoalsMetText((r.goals_met ?? []).join("\n"));
    setGoalsMissedText((r.goals_missed ?? []).join("\n"));
  }

  async function saveEdit() {
    if (!editing || !canManage) return;
    setBusy(true);
    const body: Record<string, unknown> = { ai_summary: summary.trim() };
    const s = score.trim();
    if (s === "") body.score = null;
    else {
      const n = Number.parseInt(s, 10);
      if (Number.isNaN(n) || n < 1 || n > 10) {
        setBusy(false);
        setError("Score must be blank or 1–10.");
        return;
      }
      body.score = n;
    }
    const td = topDomainsJson.trim();
    if (td) {
      try {
        body.top_domains = JSON.parse(td) as unknown;
      } catch {
        setBusy(false);
        setError("Top domains must be valid JSON.");
        return;
      }
    } else {
      body.top_domains = null;
    }
    body.goals_met = goalsMetText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    body.goals_missed = goalsMissedText
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

    try {
      const res = await adminApi(`/api/admin/reports/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save report.");
        return;
      }
      setEditing(null);
      onDataChanged();
      setLoading(true);
      await fetchPage(0, false);
      setLoading(false);
    } catch {
      setBusy(false);
      setError("Could not save report.");
    }
  }

  const hasMore = rows.length < total;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Generated daily reports (Pro). You can fix text or scores if something went wrong.</p>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted">No saved reports for this member.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Summary</th>
                {canManage && <th className="px-3 py-2 font-medium"> </th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-3 py-2 align-top text-foreground">{r.date}</td>
                  <td className="px-3 py-2 align-top text-muted">{r.score ?? "—"}</td>
                  <td className="px-3 py-2 align-top text-muted">
                    <div className="line-clamp-3 max-w-md">{r.ai_summary}</div>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 align-top">
                      <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEdit(r)}>
                        Edit
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

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-card p-5 shadow-xl">
            <h3 className="text-base font-medium text-foreground">Edit report · {editing.date}</h3>
            <FieldWithHint
              id={`admin-report-score-${userId}`}
              label="Score (1–10, or leave empty for none)"
              hint="Optional accountability score from the AI report. Integer 1–10, or blank to store no score (shown as — in the UI)."
              className="mt-4 text-sm text-muted"
            >
              <input
                id={`admin-report-score-${userId}`}
                className={inputClass}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </FieldWithHint>
            <FieldWithHint
              id={`admin-report-summary-${userId}`}
              label="AI summary"
              hint="Main narrative shown to the user for this date. Edit typos, tone, or factual mistakes; this is plain text shown in the dashboard."
              className="mt-4 text-sm text-muted"
            >
              <textarea
                id={`admin-report-summary-${userId}`}
                className={`${inputClass} min-h-[120px]`}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </FieldWithHint>
            <FieldWithHint
              id={`admin-report-top-domains-${userId}`}
              label="Top domains (JSON, or empty to clear)"
              hint="Structured snapshot of sites the model used (array/object as JSON). Must parse with JSON.parse. Wrong syntax will block save. Empty clears the field."
              className="mt-4 text-sm text-muted"
            >
              <textarea
                id={`admin-report-top-domains-${userId}`}
                className={`${inputClass} min-h-[100px] font-mono text-xs`}
                value={topDomainsJson}
                onChange={(e) => setTopDomainsJson(e.target.value)}
              />
            </FieldWithHint>
            <FieldWithHint
              id={`admin-report-goals-met-${userId}`}
              label="Goals met (one per line)"
              hint="Bullet list of intentions the report considered achieved. One line per item; becomes a string array in the database."
              className="mt-4 text-sm text-muted"
            >
              <textarea
                id={`admin-report-goals-met-${userId}`}
                className={`${inputClass} min-h-[72px] font-mono text-xs`}
                value={goalsMetText}
                onChange={(e) => setGoalsMetText(e.target.value)}
              />
            </FieldWithHint>
            <FieldWithHint
              id={`admin-report-goals-missed-${userId}`}
              label="Goals missed (one per line)"
              hint="Intentions the report said were not met. Same format as goals met—one per line, stored as an array."
              className="mt-4 text-sm text-muted"
            >
              <textarea
                id={`admin-report-goals-missed-${userId}`}
                className={`${inputClass} min-h-[72px] font-mono text-xs`}
                value={goalsMissedText}
                onChange={(e) => setGoalsMissedText(e.target.value)}
              />
            </FieldWithHint>
            <div className="mt-4 flex gap-2">
              <Button type="button" disabled={busy} onClick={() => void saveEdit()}>
                {busy ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
