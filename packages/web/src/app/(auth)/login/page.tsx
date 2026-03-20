"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm text-muted">
          Email
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="block text-sm text-muted">
          Password
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
