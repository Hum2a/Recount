import { createHash } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../logger.js";

function clientIp(req) {
  if (!req || typeof req !== "object") return null;
  const xf = req.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) {
    return xf.split(",")[0].trim() || null;
  }
  if (typeof req.ip === "string" && req.ip.length) return req.ip;
  const sock = req.socket?.remoteAddress;
  return typeof sock === "string" && sock.length ? sock : null;
}

/**
 * Record a login or signup for analytics / support. Never throws; logs on failure.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{ userId: string; eventType: "login" | "signup"; provider?: string; req?: import("express").Request }} opts
 */
export async function recordLoginEvent(supabaseAdmin, opts) {
  const { userId, eventType, provider = "password", req } = opts;
  let userAgent = null;
  if (req?.headers?.["user-agent"]) {
    userAgent = String(req.headers["user-agent"]).slice(0, 400);
  }
  const salt = env.LOGIN_AUDIT_SALT;
  const ip = clientIp(req);
  let ipHash = null;
  if (salt && ip) {
    ipHash = createHash("sha256").update(`${salt}|${ip}`, "utf8").digest("hex");
  }

  const { error } = await supabaseAdmin.from("login_events").insert({
    user_id: userId,
    event_type: eventType,
    provider,
    user_agent: userAgent,
    ip_hash: ipHash,
  });

  if (error) {
    logger.warn({ err: error, userId, eventType }, "login_events insert failed");
  }
}
