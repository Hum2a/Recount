import { supabaseAdmin } from "../db/client.js";
import { logger } from "../logger.js";

export async function ensureProfile(user) {
  const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) {
    logger.error({ err: error }, "ensureProfile select");
    throw Object.assign(new Error("Profile lookup failed"), { status: 500 });
  }
  if (data) return;
  const email = user.email ?? "";
  const { error: insertErr } = await supabaseAdmin.from("profiles").insert({ id: user.id, email });
  if (insertErr) {
    logger.error({ err: insertErr }, "ensureProfile insert");
    throw Object.assign(new Error("Could not create profile"), { status: 500 });
  }
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });

    await ensureProfile(data.user);
    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireLicense(req, res, next) {
  try {
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
