import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";
import { firstForwardedIp, sha256Hex } from "../utils";

type EventType = "login" | "signup";

export async function recordLoginEvent(opts: {
  env: WorkerEnv;
  userId: string;
  eventType: EventType;
  provider?: string;
  userAgent?: string | null;
  forwardedFor?: string | null;
}) {
  const { env, userId, eventType, provider = "password", userAgent, forwardedFor } = opts;
  const supabaseAdmin = createSupabaseAdmin(env);

  let ipHash: string | null = null;
  const salt = env.LOGIN_AUDIT_SALT;
  const ip = firstForwardedIp(forwardedFor ?? null);
  if (salt && ip) ipHash = sha256Hex(`${salt}|${ip}`);

  await supabaseAdmin.from("login_events").insert({
    user_id: userId,
    event_type: eventType,
    provider,
    user_agent: userAgent ? userAgent.slice(0, 400) : null,
    ip_hash: ipHash,
  });
}
