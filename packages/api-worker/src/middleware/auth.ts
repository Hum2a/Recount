import { createSupabaseAdmin } from "../supabase";
import { getBearerToken } from "../utils";
import type { AppVars } from "../types";
import type { WorkerEnv } from "../env";
import type { MiddlewareHandler } from "hono";

const STAFF_APP_ROLES = ["admin", "developer"] as const;

async function loadOrCreateProfile(env: WorkerEnv, user: { id: string; email?: string | null }) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, app_role, license_active")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Profile lookup failed");
  if (data) return data;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("profiles")
    .insert({ id: user.id, email: user.email ?? "" })
    .select("id, app_role, license_active")
    .single();
  if (!insertErr && inserted) return inserted;

  const { data: race, error: raceErr } = await supabaseAdmin
    .from("profiles")
    .select("id, app_role, license_active")
    .eq("id", user.id)
    .maybeSingle();
  if (raceErr) throw new Error("Profile lookup failed");
  if (race) return race;
  throw new Error("Could not create profile");
}

export const requireAuth: MiddlewareHandler<{ Bindings: WorkerEnv; Variables: AppVars }> = async (c, next) => {
  const token = getBearerToken(c.req.header("Authorization") ?? null);
  if (!token) return c.json({ error: "Missing token" }, 401);

  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return c.json({ error: "Invalid token" }, 401);

  try {
    const profile = await loadOrCreateProfile(c.env, data.user);
    c.set("user", data.user);
    c.set("accessToken", token);
    c.set("profile", profile);
  } catch {
    return c.json({ error: "Profile lookup failed" }, 500);
  }

  await next();
};

export async function userHasLicense(env: WorkerEnv, userId: string) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data } = await supabaseAdmin.from("profiles").select("license_active").eq("id", userId).single();
  return Boolean(data?.license_active);
}

export async function userHasLicensedOrStaffAccess(env: WorkerEnv, userId: string) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("license_active, app_role")
    .eq("id", userId)
    .single();
  if (!data) return false;
  if (data.license_active) return true;
  return Boolean(data.app_role && (STAFF_APP_ROLES as readonly string[]).includes(data.app_role));
}

export const requireLicense: MiddlewareHandler<{ Bindings: WorkerEnv; Variables: AppVars }> = async (c, next) => {
  const profile = c.get("profile");
  if (profile?.license_active) {
    await next();
    return;
  }
  if (profile?.app_role && (STAFF_APP_ROLES as readonly string[]).includes(profile.app_role)) {
    await next();
    return;
  }
  const ok = await userHasLicensedOrStaffAccess(c.env, c.get("user").id);
  if (!ok) return c.json({ error: "License required" }, 403);
  await next();
};
