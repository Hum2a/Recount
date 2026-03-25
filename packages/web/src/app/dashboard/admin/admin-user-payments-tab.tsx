"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "./admin-fetch";

type Payment = {
  id: string;
  user_id: string;
  stripe_payment_id: string;
  amount_pence: number;
  currency: string;
  status: string;
  created_at: string;
};

type Props = {
  userId: string;
};

const limit = 40;

function formatMoney(pence: number, currency: string) {
  const major = pence / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(major);
  } catch {
    return `${major} ${currency}`;
  }
}

export function AdminUserPaymentsTab({ userId }: Props) {
  const [rows, setRows] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const res = await adminApi(`/api/admin/users/${userId}/payments?${params}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load payments.");
        return;
      }
      const data = body.data as { payments?: Payment[]; total?: number } | undefined;
      const list = data?.payments ?? [];
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

  const hasMore = rows.length < total;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Records created from Stripe checkouts. Amounts and status should match Stripe; this view is read-only.
      </p>

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <p className="text-sm text-muted">No payment rows stored for this member.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Stripe id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="px-3 py-2 align-top text-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 align-top text-foreground">{formatMoney(r.amount_pence, r.currency)}</td>
                  <td className="px-3 py-2 align-top text-muted">{r.status}</td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-muted">{r.stripe_payment_id}</td>
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
