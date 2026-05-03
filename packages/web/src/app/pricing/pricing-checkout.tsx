"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-url";
import { hasFullProductAccess } from "@/lib/entitlements";

export function PricingCheckout() {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [licensed, setLicensed] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setToken(data.session?.access_token ?? null);
      if (data.session?.access_token) {
        const res = await fetch(`${getApiBaseUrl()}/api/payments/status`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const body = await res.json().catch(() => ({}));
        setLicensed(
          hasFullProductAccess(Boolean(body.data?.license_active), body.data?.app_role as string | undefined)
        );
      }
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkout() {
    setErr(null);
    setLoading(true);
    if (!token) {
      setErr("Sign in first.");
      setLoading(false);
      return;
    }
    const res = await fetch(`${getApiBaseUrl()}/api/payments/create-session`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(body.error ?? "Could not start checkout");
      return;
    }
    const url = body.data?.url;
    if (url) window.location.href = url;
  }

  if (!ready) {
    return <p className="text-sm text-muted">Loading…</p>;
  }

  if (!token) {
    return (
      <div className="space-y-2">
        <Link href={`/login?next=${encodeURIComponent("/pricing")}`}>
          <Button className="w-full">Sign in to unlock</Button>
        </Link>
        <p className="text-center text-xs text-muted">Or create an account first.</p>
      </div>
    );
  }

  if (licensed) {
    return (
      <p className="text-sm text-emerald-400">
        You already have full access. Open the{" "}
        <Link href="/dashboard" className="underline">
          dashboard
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={checkout} disabled={loading}>
        {loading ? "Redirecting…" : "Unlock lifetime access — £9.99"}
      </Button>
      {err && <p className="text-center text-xs text-red-400">{err}</p>}
    </div>
  );
}
