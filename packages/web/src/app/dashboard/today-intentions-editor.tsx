"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";

type Props = {
  date: string;
  initialGoals: string[];
};

export function TodayIntentionsEditor({ date, initialGoals }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialGoals.join("\n"));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setMsg(null);
    const goals = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (goals.some((g) => g.length > 500)) {
      setMsg("Each goal must be at most 500 characters.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setMsg("Sign in again.");
        return;
      }
      const res = await fetch(`${getApiBaseUrl()}/api/intentions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date, goals }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof body.error === "string" ? body.error : "Could not save intentions.");
        return;
      }
      setMsg("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
      <label htmlFor="dashboard-intentions" className="text-xs font-medium text-muted">
        Edit today&apos;s goals (optional — one per line, max 20)
      </label>
      <textarea
        id="dashboard-intentions"
        className={cn(
          "min-h-[100px] w-full resize-y rounded-md border border-white/10 bg-card px-3 py-2 font-sans text-sm text-foreground",
          "focus-visible:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        )}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={20 * 502}
        placeholder="Ship the draft doc&#10;Exercise"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" className="text-sm" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save intentions"}
        </Button>
        {msg ? <span className="text-xs text-muted">{msg}</span> : null}
      </div>
    </div>
  );
}
