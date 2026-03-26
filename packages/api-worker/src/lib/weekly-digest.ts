import { createSupabaseAdmin } from "../supabase";
import { sendWeeklyDigestEmail } from "../services/resend";
import type { WorkerEnv } from "../env";

export function previousUtcWeekRange() {
  const d = new Date();
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(today).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(thisMonday.getUTCDate() + mondayOffset);
  const prevMonday = new Date(thisMonday);
  prevMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
  return {
    start: prevMonday.toISOString().slice(0, 10),
    end: prevSunday.toISOString().slice(0, 10),
  };
}

export async function buildDigestPayloadForUser(env: WorkerEnv, userId: string, range: { start: string; end: string }) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data: events, error: evErr } = await supabaseAdmin
    .from("tab_events")
    .select("domain, duration_sec")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end);
  if (evErr) throw new Error(evErr.message);

  const byDomain: Record<string, number> = {};
  let totalSec = 0;
  for (const row of events ?? []) {
    const sec = Number(row.duration_sec ?? 0);
    totalSec += sec;
    const dom = String(row.domain || "unknown");
    byDomain[dom] = (byDomain[dom] ?? 0) + sec;
  }
  const top = Object.entries(byDomain)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  const { data: intentions, error: intErr } = await supabaseAdmin
    .from("intentions")
    .select("goals")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end);
  if (intErr) throw new Error(intErr.message);

  let intentionDays = 0;
  for (const row of intentions ?? []) {
    const g = row.goals as unknown[];
    if (Array.isArray(g) && g.some((x) => String(x).trim().length > 0)) intentionDays += 1;
  }

  return {
    total_minutes: Math.round(totalSec / 60),
    top_domains: top,
    intention_days: intentionDays,
  };
}

export async function runWeeklyDigestJob(env: WorkerEnv) {
  const range = previousUtcWeekRange();
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("weekly_digest_enabled", true);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  for (const p of profiles ?? []) {
    if (!p.email) continue;
    try {
      const payload = await buildDigestPayloadForUser(env, p.id, range);
      const ok = await sendWeeklyDigestEmail(env, p.email, range, payload);
      if (ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { range, recipients: (profiles ?? []).length, sent, failed };
}
