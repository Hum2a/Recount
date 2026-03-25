import { supabaseAdmin } from "../db/client.js";

const TRACKING_MIN_SEC_PER_DAY = 300;

function utcDateStringDaysAgo(daysBack) {
  const d = new Date();
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack);
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * @param {string} userId
 * @param {number} lookbackDays
 */
export async function computeStreaksForUser(userId, lookbackDays = 120) {
  const start = utcDateStringDaysAgo(lookbackDays);

  const [{ data: intentions }, { data: events }] = await Promise.all([
    supabaseAdmin.from("intentions").select("date, goals").eq("user_id", userId).gte("date", start),
    supabaseAdmin.from("tab_events").select("date, duration_sec").eq("user_id", userId).gte("date", start),
  ]);

  /** @type {Set<string>} */
  const intentionDays = new Set();
  for (const row of intentions ?? []) {
    const goals = row.goals;
    if (Array.isArray(goals) && goals.some((g) => String(g).trim().length > 0)) {
      intentionDays.add(row.date);
    }
  }

  /** @type {Record<string, number>} */
  const secondsByDate = {};
  for (const row of events ?? []) {
    const ds = row.date;
    if (!ds) continue;
    secondsByDate[ds] = (secondsByDate[ds] ?? 0) + (row.duration_sec ?? 0);
  }

  function countStreak(isGoodDay) {
    let streak = 0;
    for (let i = 0; i < lookbackDays; i++) {
      const ds = utcDateStringDaysAgo(i);
      if (isGoodDay(ds)) streak += 1;
      else break;
    }
    return streak;
  }

  const intention_streak = countStreak((ds) => intentionDays.has(ds));
  const tracking_streak = countStreak((ds) => (secondsByDate[ds] ?? 0) >= TRACKING_MIN_SEC_PER_DAY);

  return {
    intention_streak,
    tracking_streak,
    tracking_min_sec_per_day: TRACKING_MIN_SEC_PER_DAY,
  };
}
