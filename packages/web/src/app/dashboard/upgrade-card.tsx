"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-url";

export function UpgradeCard() {
  const [err, setErr] = useState<string | null>(null);
  const reduce = useReducedMotion();

  async function checkout() {
    setErr(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setErr("Sign in again.");
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
    if (!res.ok) {
      setErr(body.error ?? "Could not start checkout");
      return;
    }
    const url = body.data?.url;
    if (url) window.location.href = url;
  }

  return (
    <motion.div
      className="rounded-xl border border-accent/40 bg-card/90 p-6 shadow-lg shadow-blue-500/10 backdrop-blur-sm ring-0"
      whileHover={
        reduce
          ? undefined
          : {
              y: -4,
              boxShadow: "0 24px 48px -12px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(96, 165, 250, 0.25)",
              transition: { type: "spring", stiffness: 400, damping: 26 },
            }
      }
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-medium">Unlock lifetime access</h2>
          <p className="mt-1 text-sm text-muted">
            £14.99 one-time — full history, AI end-of-day reports, trends, CSV export.
          </p>
        </div>
        <Button onClick={checkout}>Unlock lifetime access — £14.99</Button>
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
    </motion.div>
  );
}
