import { supabaseAdmin } from "../db/client.js";
import { sendWeeklyDigestEmail } from "../services/resend.js";
import { logger } from "../logger.js";

/** Previous calendar week Mon–Sun in UTC as YYYY-MM-DD */
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

/**
 * @param {{ start: string, end: string }} range
 */
export async function buildDigestPayloadForUser(userId, range) {
  const { data: events, error: evErr } = await supabaseAdmin
    .from("tab_events")
    .select("domain, duration_sec, category")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end);

  if (evErr) throw new Error(evErr.message);

  /** @type {Record<string, number>} */
  const byDomain = {};
  let totalSec = 0;
  for (const row of events ?? []) {
    const sec = row.duration_sec ?? 0;
    totalSec += sec;
    const dom = row.domain || "unknown";
    byDomain[dom] = (byDomain[dom] ?? 0) + sec;
  }

  const top = Object.entries(byDomain)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  const { data: intentions, error: intErr } = await supabaseAdmin
    .from("intentions")
    .select("date, goals")
    .eq("user_id", userId)
    .gte("date", range.start)
    .lte("date", range.end);

  if (intErr) throw new Error(intErr.message);

  let intentionDays = 0;
  for (const row of intentions ?? []) {
    const g = row.goals;
    if (Array.isArray(g) && g.some((x) => String(x).trim().length > 0)) intentionDays += 1;
  }

  return {
    total_minutes: Math.round(totalSec / 60),
    top_domains: top,
    intention_days: intentionDays,
  };
}

export async function runWeeklyDigestJob() {
  const range = previousUtcWeekRange();
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
      const payload = await buildDigestPayloadForUser(p.id, range);
      const ok = await sendWeeklyDigestEmail(p.email, range, payload);
      if (ok) sent += 1;
      else failed += 1;
    } catch (e) {
      failed += 1;
      logger.error({ err: e, userId: p.id }, "weekly digest user failed");
    }
  }

  return { range, recipients: (profiles ?? []).length, sent, failed };
}
