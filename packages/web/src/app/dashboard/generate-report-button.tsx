"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { getApiBaseUrl } from "@/lib/api-url";

/** Slightly above the API OpenAI client timeout (90s) so hung proxies fail cleanly on the client. */
const REPORT_GENERATE_CLIENT_TIMEOUT_MS = 95_000;

function isAbortError(e: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function idleLabel(date: string, mode: "generate" | "regenerate"): string {
  if (mode === "regenerate") {
    return date === todayUtc() ? "Regenerate today's report" : `Regenerate · ${date}`;
  }
  return date === todayUtc() ? "Generate today's report" : `Generate report · ${date}`;
}

function buttonLabel(
  date: string,
  loading: boolean,
  slowNotice: boolean,
  mode: "generate" | "regenerate"
): string {
  if (!loading) return idleLabel(date, mode);
  if (slowNotice) return "Still generating…";
  return "Generating…";
}

type Props = {
  date: string;
  /** Narrow layout for inline rows (e.g. reports list). */
  variant?: "default" | "compact";
  /** If set, shows a browser confirm dialog before calling the API (regenerate flow). */
  confirmPrompt?: string;
  /** When `confirmPrompt` is set, use regenerate labels instead of generate. */
  mode?: "generate" | "regenerate";
};

/** POST /api/reports/generate error body (Phase 2). */
type GenerateErrorBody = { error?: string; code?: string };

export function GenerateReportButton({
  date,
  variant = "default",
  confirmPrompt,
  mode = "generate",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [slowNotice, setSlowNotice] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      setSlowNotice(false);
      return;
    }
    const t = window.setTimeout(() => setSlowNotice(true), 15_000);
    return () => window.clearTimeout(t);
  }, [loading]);

  async function run() {
    if (confirmPrompt && typeof window !== "undefined" && !window.confirm(confirmPrompt)) {
      return;
    }
    setErr(null);
    setSlowNotice(false);
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setErr("Sign in again.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REPORT_GENERATE_CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reports/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ date }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => ({}))) as GenerateErrorBody;
      if (!res.ok) {
        const message =
          typeof body.error === "string" && body.error.length > 0 ? body.error : "Generation failed";
        setErr(message);
        return;
      }
      router.push(`/dashboard/reports/${date}`);
      router.refresh();
    } catch (e) {
      if (isAbortError(e)) {
        setErr(
          "This took longer than 95 seconds, so the browser stopped waiting. The server may still finish — check Reports — or try again."
        );
        return;
      }
      setErr("Could not reach the API. Check your connection and try again.");
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const labelMode: "generate" | "regenerate" = confirmPrompt ? "regenerate" : mode;
  const label = buttonLabel(date, loading, slowNotice, labelMode);

  const slowHint =
    loading && slowNotice ? (
      <p className="max-w-xs text-right text-xs text-amber-200/90">
        Still working — large days can take up to ~90 seconds. After ~95s the browser stops waiting (you can still
        open Reports to see if it finished).
      </p>
    ) : null;

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={run}
          disabled={loading}
        >
          {label}
        </Button>
        {slowHint}
        {err && <span className="text-xs text-red-400">{err}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={run} disabled={loading}>
        {label}
      </Button>
      {slowHint}
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  );
}
