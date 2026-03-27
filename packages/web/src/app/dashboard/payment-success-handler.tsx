"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function PaymentSuccessHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (params.get("payment") !== "success" || done.current) return;
    done.current = true;

    let cancelled = false;
    const started = Date.now();

    async function poll() {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;

      while (!cancelled && Date.now() - started < 30_000) {
        const res = await fetch(`${apiUrl}/api/payments/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (body.data?.license_active) {
          setMsg("Payment confirmed — full access unlocked.");
          window.dispatchEvent(new Event("recount:entitlements-refresh"));
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setMsg("Still confirming payment — refresh in a moment.");
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  if (!msg) return null;
  return (
    <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
      {msg}
    </div>
  );
}
