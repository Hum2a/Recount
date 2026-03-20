"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const ROLES = ["user", "admin", "developer"] as const;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function AdminRoleForm() {
  const [userId, setUserId] = useState("");
  const [appRole, setAppRole] = useState<(typeof ROLES)[number]>("user");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const trimmed = userId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(trimmed)) {
      setMsg("Enter a valid UUID (Supabase user id).");
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setMsg("Sign in again.");
      setBusy(false);
      return;
    }
    const res = await fetch(`${apiUrl}/api/admin/users/${trimmed}/role`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app_role: appRole }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMsg(`Updated ${trimmed} → ${appRole}.`);
      return;
    }
    setMsg(
      typeof body.error === "string"
        ? body.error
        : res.status === 403
          ? "Only admins may change roles (developers can view this page only)."
          : "Request failed."
    );
  }

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-white/10 bg-card/40 p-5">
      <h3 className="text-base font-medium">Assign app role</h3>
      <p className="text-sm text-muted">
        Uses the API with your session. The server checks you are an <strong>admin</strong> — requests cannot be
        spoofed into granting admin without a valid admin JWT.
      </p>
      <label className="block text-sm text-muted">
        User id (UUID) from Supabase → Authentication → Users
        <input
          className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 font-mono text-sm text-foreground"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
          autoComplete="off"
        />
      </label>
      <label className="block text-sm text-muted">
        New role
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-foreground"
          value={appRole}
          onChange={(e) => setAppRole(e.target.value as (typeof ROLES)[number])}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" disabled={busy} onClick={() => void submit()}>
        {busy ? "Saving…" : "Update role"}
      </Button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
