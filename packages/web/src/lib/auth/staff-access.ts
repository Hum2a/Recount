import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Matches API / DB `profiles.app_role` for staff routes. */
export const STAFF_ROLES = ["admin", "developer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Full admin portal + mutating `/api/admin/*` access. Today both staff roles qualify; use this if a read-only staff tier is added later.
 */
export function staffHasFullManageAccess(role: StaffRole): boolean {
  return role === "admin" || role === "developer";
}

function isStaffRole(r: string | undefined | null): r is StaffRole {
  return Boolean(r && (STAFF_ROLES as readonly string[]).includes(r));
}

/**
 * Server-only gate for `/dashboard/admin`: calls the API with the user’s real session token.
 * Runs on the Next server — not modifiable from DevTools; token is bound to Supabase auth.
 */
export const getVerifiedStaffAccess = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { app_role?: string } };
  const role = body.data?.app_role;
  if (!isStaffRole(role)) return null;

  return { user, role };
});

/**
 * Nav visibility: reads `profiles` under RLS (own row only). Cannot return a fake role without DB changes.
 */
export const getMaybeStaffForNav = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
  if (error || !data?.app_role) return false;
  return isStaffRole(data.app_role);
});
