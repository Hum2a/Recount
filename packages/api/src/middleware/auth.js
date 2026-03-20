import { supabaseAdmin } from "../db/client.js";
import { logger } from "../logger.js";

/**
 * @param {import("@supabase/supabase-js").User} user
 * @returns {Promise<{ id: string, app_role: string, license_active: boolean }>}
 */
async function loadOrCreateProfile(user) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, app_role, license_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, "loadOrCreateProfile select");
    throw Object.assign(new Error("Profile lookup failed"), { status: 500 });
  }
  if (data) return data;

  const email = user.email ?? "";
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("profiles")
    .insert({ id: user.id, email })
    .select("id, app_role, license_active")
    .single();

  if (!insertErr && inserted) return inserted;

  const { data: race, error: raceErr } = await supabaseAdmin
    .from("profiles")
    .select("id, app_role, license_active")
    .eq("id", user.id)
    .maybeSingle();

  if (raceErr) {
    logger.error({ err: raceErr }, "loadOrCreateProfile re-select");
    throw Object.assign(new Error("Profile lookup failed"), { status: 500 });
  }
  if (race) return race;

  logger.error({ err: insertErr }, "loadOrCreateProfile insert");
  throw Object.assign(new Error("Could not create profile"), { status: 500 });
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });

    const profile = await loadOrCreateProfile(data.user);
    req.user = data.user;
    req.accessToken = token;
    req.profile = profile;
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireLicense(req, res, next) {
  try {
    if (req.profile?.license_active) {
      next();
      return;
    }
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("license_active")
      .eq("id", req.user.id)
      .single();

    if (error || !data?.license_active) {
      return res.status(403).json({ error: "License required" });
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** @returns {Promise<boolean>} */
export async function userHasLicense(userId) {
  const { data } = await supabaseAdmin.from("profiles").select("license_active").eq("id", userId).single();
  return Boolean(data?.license_active);
}
