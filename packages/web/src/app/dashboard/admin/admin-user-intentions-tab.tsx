"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "./admin-fetch";

type Intention = {
  id: string;
  user_id: string;
  date: string;
  goals: string[];
  created_at: string;
};

type Props = {
  userId: string;
  canManage: boolean;
  onDataChanged: () => void;
};

const inputClass =
  "mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70";

const limit = 30;

export function AdminUserIntentionsTab({ userId, canManage, onDataChanged }: Props) {
  const [rows, setRows] = useState<Intention[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Intention | null>(null);
  const [goalsText, setGoalsText] = useState("");
  const [editDate, setEditDate] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await adminApi(`/api/admin/users/${userId}/intentions?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load intentions.");
        return null;
      }
      const data = body.data as { intentions?: Intention[]; total?: number } | undefined;
      const list = data?.intentions ?? [];
      setTotal(data?.total ?? 0);
      setError(null);
      if (append) setRows((prev) => [...prev, ...list]);
      else setRows(list);
      return list;
    },
    [userId, from, to]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
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

  function openEdit(row: Intention) {
    setEditing(row);
    setGoalsText(row.goals.join("\n"));
    setEditDate(row.date);
  }

  async function saveEdit() {
    if (!editing || !canManage) return;
    setBusy(true);
    const goals = goalsText
      .split("\n")
      .map((g) => g.trim())
      .filter(Boolean);
    try {
      const res = await adminApi(`/api/admin/intentions/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ goals, date: editDate }),
      });
      const body = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not save.");
        return;
      }
      setEditing(null);
      onDataChanged();
      setLoading(true);
      await fetchPage(0, false);
      setLoading(false);
    } catch {
      setBusy(false);
      setError("Could not save.");
    }
  }

  async function remove(id: string) {
    if (!canManage || !confirm("Delete this day’s intentions?")) return;
    try {
      const res = await adminApi(`/api/admin/intentions/${id}`, { method: "DELETE" });
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
      <p className="text-sm text-muted">Daily goals the member set in the extension (one row per calendar day).</p>
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

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted">No intentions in this range.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Goals</th>
                {canManage && <th className="px-3 py-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-3 py-2 align-top text-foreground">{r.date}</td>
                  <td className="px-3 py-2 align-top text-muted">
                    <ul className="list-inside list-disc">
                      {r.goals.length ? r.goals.map((g) => <li key={g}>{g}</li>) : <li>None</li>}
                    </ul>
                  </td>
                  {canManage && (
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => openEdit(r)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-300 hover:text-red-200"
                          onClick={() => void remove(r.id)}
                        >
                          Delete
                        </Button>
                      </div>
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-card p-5 shadow-xl">
            <h3 className="text-base font-medium text-foreground">Edit intentions</h3>
            <label className="mt-4 block text-sm text-muted">
              Date
              <input type="date" className={inputClass} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </label>
            <label className="mt-4 block text-sm text-muted">
              Goals (one per line)
              <textarea
                className={`${inputClass} min-h-[140px] font-mono text-xs`}
                value={goalsText}
                onChange={(e) => setGoalsText(e.target.value)}
              />
            </label>
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
