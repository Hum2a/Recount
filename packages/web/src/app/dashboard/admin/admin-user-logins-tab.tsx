"use client";

import { useEffect, useState } from "react";
import { adminApi } from "./admin-fetch";

type LoginRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  provider: string;
  user_agent: string | null;
  ip_hash: string | null;
};

export function AdminUserLoginsTab({ userId }: { userId: string }) {
  const [events, setEvents] = useState<LoginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await adminApi(`/api/admin/users/${userId}/login-events?limit=100`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setErr(typeof body.error === "string" ? body.error : "Could not load login history.");
            setEvents([]);
          }
          return;
        }
        const d = body.data as { events?: LoginRow[]; total?: number } | undefined;
        if (!cancelled) {
          setEvents(d?.events ?? []);
          setTotal(d?.total ?? 0);
        }
      } catch {
        if (!cancelled) setErr("Could not load login history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <p className="text-sm text-muted">Loading login history…</p>;
  if (err) return <p className="text-sm text-red-200">{err}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Password logins and signups recorded by the API. IP is stored as a hash when{" "}
        <code className="text-foreground/80">LOGIN_AUDIT_SALT</code> is configured.
      </p>
      <p className="text-xs text-muted">Showing {events.length} of {total} events.</p>
      {events.length === 0 ? (
        <p className="text-sm text-muted">No events yet (older accounts predate this feature).</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-3 py-2 font-medium">When (UTC)</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Provider</th>
                <th className="px-3 py-2 font-medium">User agent</th>
                <th className="px-3 py-2 font-medium">IP hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-white/5">
                  <td className="px-3 py-2 whitespace-nowrap text-muted">
                    {new Date(e.occurred_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 text-foreground">{e.event_type}</td>
                  <td className="px-3 py-2 text-muted">{e.provider}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 font-mono text-xs text-muted" title={e.user_agent ?? ""}>
                    {e.user_agent ?? "—"}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs text-muted" title={e.ip_hash ?? ""}>
                    {e.ip_hash ? `${e.ip_hash.slice(0, 12)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
