"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "./admin-fetch";

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

type Props = {
  userId: string;
  canManage: boolean;
  onDataChanged: () => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

const limit = 40;

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminUserActivityTab({ userId, canManage, onDataChanged }: Props) {
  const [rows, setRows] = useState<TabEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await adminApi(`/api/admin/users/${userId}/tab-events?${params}`);
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
    [userId, from, to]
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
  }, [userId, from, to, fetchPage]);

  async function loadMore() {
    if (rows.length >= total || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(rows.length, true);
    setLoadingMore(false);
  }

  async function remove(id: string) {
    if (!canManage || !confirm("Delete this activity row? This cannot be undone.")) return;
    try {
      const res = await adminApi(`/api/admin/tab-events/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        setError(typeof body.error === "string" ? body.error : "Could not delete.");
        return;
      }
      onDataChanged();
      setLoading(true);
      await fetchPage(0, false);
      setLoading(false);
    } catch {
      setError("Could not delete.");
    }
  }

  const hasMore = rows.length < total;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Raw browser time segments from the extension. Usually you only need this for corrections or privacy requests.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">
          From
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm text-muted">
          To
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && rows.length === 0 && !error && <p className="text-sm text-muted">No activity in this range.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-2 py-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Domain</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Start</th>
                {canManage && <th className="px-2 py-2 font-medium"> </th>}
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
                  {canManage && (
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
