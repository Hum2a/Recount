"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function GenerateReportButton({ date }: { date: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setErr("Sign in again.");
      setLoading(false);
      return;
    }
    const res = await fetch(`${apiUrl}/api/reports/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ date }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(body.error ?? "Generation failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={run} disabled={loading}>
        {loading ? "Generating…" : "Generate today’s report"}
      </Button>
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
