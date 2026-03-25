"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FieldWithHint, HintTrigger } from "@/components/ui/field-hint";
import { AnimatedCard } from "@/components/motion/animated-card";

const ROLES = ["user", "admin", "developer"] as const;
type AppRole = (typeof ROLES)[number];

type UserRow = {
  id: string;
  email: string;
  display_name?: string | null;
  country_code?: string | null;
  app_role: string;
  license_active: boolean;
  created_at: string;
};

const ACCESS_HELP: Record<AppRole, string> = {
  user: "Regular Recount user — no staff tools.",
  admin: "Can open this page and change who is admin or developer.",
  developer: "Can open this page to view the directory; only admins can change roles.",
};

function accessLabel(role: string): string {
  if (role === "admin") return "Administrator";
  if (role === "developer") return "Developer (staff)";
  return "Member";
}

function planLabel(active: boolean): string {
  return active ? "Paid (Pro)" : "Free";
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Props = {
  canEditRoles: boolean;
  currentUserId: string;
};

export function AdminUsersPanel({ canEditRoles, currentUserId }: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, AppRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const limit = 40;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadPage = useCallback(
    async (opts: { append: boolean; nextOffset: number }) => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Your session expired. Sign in again.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(opts.nextOffset),
      });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`${apiUrl}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Could not load people.");
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      const payload = body.data as { users?: UserRow[]; total?: number } | undefined;
      const nextUsers = payload?.users ?? [];
      setTotal(payload?.total ?? 0);
      setOffset(opts.nextOffset + nextUsers.length);
      setUsers((prev) => (opts.append ? [...prev, ...nextUsers] : nextUsers));
      setError(null);
      setLoading(false);
      setLoadingMore(false);
    },
    [debouncedSearch, limit]
  );

  useEffect(() => {
    setLoading(true);
    setUsers([]);
    setOffset(0);
    void loadPage({ append: false, nextOffset: 0 });
  }, [debouncedSearch, loadPage]);

  const hasMore = users.length < total;

  const onLoadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void loadPage({ append: true, nextOffset: offset });
  };

  const roleForRow = (u: UserRow): AppRole =>
    (ROLES.includes(u.app_role as AppRole) ? u.app_role : "user") as AppRole;

  const setRowPending = (id: string, role: AppRole) => {
    setPendingRole((prev) => ({ ...prev, [id]: role }));
    setBanner(null);
  };

  const effectiveRole = (u: UserRow): AppRole => pendingRole[u.id] ?? roleForRow(u);

  async function saveRole(userId: string) {
    const row = users.find((x) => x.id === userId);
    if (!row) return;
    const next = pendingRole[userId];
    if (next === undefined || next === roleForRow(row)) return;
    setSavingId(userId);
    setBanner(null);
    const supabase = createClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setBanner("Sign in again to continue.");
      setSavingId(null);
      return;
    }
    const res = await fetch(`${apiUrl}/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ app_role: next }),
    });
    const body = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      setBanner(
        typeof body.error === "string"
        ? body.error
        : res.status === 403
          ? "You don’t have permission to change access level."
          : "Could not save changes."
      );
      return;
    }
    const updated = body.data as { id: string; email: string; app_role: AppRole } | undefined;
    if (updated) {
      setUsers((prev) =>
        prev.map((row) => (row.id === updated.id ? { ...row, app_role: updated.app_role } : row))
      );
      setPendingRole((prev) => {
        const nextMap = { ...prev };
        delete nextMap[userId];
        return nextMap;
      });
      setBanner(`Updated ${updated.email} to ${accessLabel(updated.app_role)}.`);
    }
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.email.localeCompare(b.email, undefined, { sensitivity: "base" }));
  }, [users]);

  return (
    <AnimatedCard
      delay={0.06}
      className="rounded-xl bg-card/80 p-6 shadow-lg shadow-black/15 ring-1 ring-white/10 backdrop-blur-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">People with a Recount account</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Search by email, see who has a paid plan, and{" "}
            {canEditRoles ? (
              <>set who can use admin tools on this page.</>
            ) : (
              <>review the directory. Your role can’t edit from here.</>
            )}
          </p>
        </div>
        {total > 0 && (
          <p className="text-sm text-muted">
            Showing <span className="text-foreground font-medium">{users.length}</span> of{" "}
            <span className="text-foreground font-medium">{total}</span>
          </p>
        )}
      </div>

      <FieldWithHint
        id="admin-users-search-email"
        label="Search by email"
        hint="Filters the directory as you type (short delay). Matches any part of the email. Leave empty to list from the start of the roster."
        className="mt-6 text-sm font-medium text-foreground"
      >
        <input
          id="admin-users-search-email"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="name@company.com"
          className="mt-1.5 w-full max-w-md rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70"
          autoComplete="off"
        />
      </FieldWithHint>

      {loading && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {error && !loading && (
        <p className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {banner && (
        <p className="mt-4 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-muted">
          {banner}
        </p>
      )}

      {!loading && !error && users.length === 0 && (
        <p className="mt-6 text-sm text-muted">No accounts match that search.</p>
      )}

      {!loading && !error && users.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-muted">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium"> </th>
                {canEditRoles && <th className="px-4 py-3 font-medium">Change access</th>}
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => {
                const you = u.id === currentUserId;
                const selected = effectiveRole(u);
                const dirty = canEditRoles && selected !== roleForRow(u);
                return (
                  <tr key={u.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <span className="font-medium text-foreground">{u.email}</span>
                      {you && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted">
                          You
                        </span>
                      )}
                      {(u.display_name || u.country_code) && (
                        <div className="mt-0.5 text-xs text-muted">
                          {[u.display_name, u.country_code].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      <div className="mt-0.5 text-xs text-muted">
                        Joined {new Date(u.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted">{planLabel(u.license_active)}</td>
                    <td className="px-4 py-3 align-top text-muted">{accessLabel(u.app_role)}</td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/dashboard/admin/users/${u.id}`}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Manage
                      </Link>
                    </td>
                    {canEditRoles && (
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            className="rounded-md border border-white/10 bg-card px-2 py-1.5 text-foreground"
                            value={selected}
                            aria-label={`Access level for ${u.email}`}
                            onChange={(e) => setRowPending(u.id, e.target.value as AppRole)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {accessLabel(r)}
                              </option>
                            ))}
                          </select>
                          <HintTrigger
                            labelForA11y="Change access"
                            hint={`Member: ${ACCESS_HELP.user} Administrator: ${ACCESS_HELP.admin} Developer: ${ACCESS_HELP.developer} Choose a role, then Save.`}
                          />
                          <Button
                            type="button"
                            className="px-3 py-1.5 text-xs"
                            disabled={!dirty || savingId === u.id}
                            onClick={() => void saveRole(u.id)}
                          >
                            {savingId === u.id ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && hasMore && (
        <div className="mt-4">
          <Button type="button" variant="secondary" disabled={loadingMore} onClick={() => void onLoadMore()}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {canEditRoles && (
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-muted">
          <p className="font-medium text-foreground">What these access levels mean</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong className="text-foreground">Member</strong> — uses Recount like any customer.
            </li>
            <li>
              <strong className="text-foreground">Administrator</strong> — full staff tools, including changing other
              people&apos;s access.
            </li>
            <li>
              <strong className="text-foreground">Developer (staff)</strong> — same portal and API powers as an
              administrator for support and engineering.
            </li>
          </ul>
          <p className="mt-3 text-xs">
            Plan (paid vs free) is handled by billing and is separate from administrator access.
          </p>
        </div>
      )}
    </AnimatedCard>
  );
}
