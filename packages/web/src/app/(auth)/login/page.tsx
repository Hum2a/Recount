"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AppMark } from "@/components/brand/app-mark";
import { Button } from "@/components/ui/button";
import { FieldWithHint } from "@/components/ui/field-hint";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      data?: { session?: { access_token: string; refresh_token: string } };
    };
    setLoading(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Sign-in failed.");
      return;
    }
    const session = body.data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      setError("No session returned.");
      return;
    }
    const supabase = createClient();
    const { error: sErr } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (sErr) {
      setError(sErr.message);
      return;
    }
    router.push(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <motion.main
      className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppMark href="/" className="mb-6" wordmarkClassName="text-xl font-semibold tracking-tight" />
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FieldWithHint
          id="login-email"
          label="Email"
          hint="The address you used when you signed up. Same account works in the browser and the Recount extension."
        >
          <input
            id="login-email"
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FieldWithHint>
        <FieldWithHint
          id="login-password"
          label="Password"
          hint="Your Recount account password. If you use a password manager, paste here or use its browser fill."
        >
          <input
            id="login-password"
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </FieldWithHint>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </motion.main>
  );
}
