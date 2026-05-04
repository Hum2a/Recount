"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { AppMark } from "@/components/brand/app-mark";
import { Button } from "@/components/ui/button";
import { FieldWithHint } from "@/components/ui/field-hint";
import { PasswordInputWithToggle } from "@/components/ui/password-input";
import { getApiBaseUrl } from "@/lib/api-url";

function getPasswordRequirements(password: string) {
  return [
    { label: "At least 12 characters", met: password.length >= 12 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(password) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(password) },
    { label: "At least one number", met: /[0-9]/.test(password) },
    { label: "At least one special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function SignupPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRequirements = getPasswordRequirements(password);
  const passwordValid = passwordRequirements.every((r) => r.met);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValid) {
      setError("Please choose a stronger password that meets all requirements.");
      return;
    }
    setLoading(true);
    const res = await fetch(`${getApiBaseUrl()}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      data?: { session?: { access_token: string; refresh_token: string } | null };
    };
    setLoading(false);
    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : "Sign-up failed.");
      return;
    }
    const session = body.data?.session;
    if (!session?.access_token || !session?.refresh_token) {
      setError("Account may have been created, but we could not start your session. Try signing in.");
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
    router.push("/dashboard");
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
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="mt-2 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" prefetch={false} className="text-accent underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FieldWithHint
          id="signup-email"
          label="Email"
          hint="We’ll use this for sign-in and important account email (e.g. confirmations). You can use the same email in the Recount browser extension."
        >
          <input
            id="signup-email"
            className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </FieldWithHint>
        <FieldWithHint
          id="signup-password"
          label="Password"
          hint="Use a strong password with 12+ characters and mixed character types. A password manager is strongly recommended."
        >
          <PasswordInputWithToggle
            id="signup-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
          />
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {passwordRequirements.map((rule) => (
              <li key={rule.label} className={rule.met ? "text-emerald-400" : "text-muted"}>
                {rule.met ? "✓" : "•"} {rule.label}
              </li>
            ))}
          </ul>
        </FieldWithHint>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={loading || !passwordValid} className="w-full">
          {loading ? "Creating…" : "Sign up"}
        </Button>
      </form>
    </motion.main>
  );
}
