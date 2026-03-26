import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";

const TRACKING_MIN_SEC_PER_DAY = 300;

function utcDateStringDaysAgo(daysBack: number) {
  const d = new Date();
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack);
  return new Date(t).toISOString().slice(0, 10);
}

export async function computeStreaksForUser(env: WorkerEnv, userId: string, lookbackDays = 120) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const start = utcDateStringDaysAgo(lookbackDays);

  const [{ data: intentions }, { data: events }] = await Promise.all([
    supabaseAdmin.from("intentions").select("date, goals").eq("user_id", userId).gte("date", start),
    supabaseAdmin.from("tab_events").select("date, duration_sec").eq("user_id", userId).gte("date", start),
  ]);

  const intentionDays = new Set<string>();
  for (const row of intentions ?? []) {
    const goals = row.goals as unknown[];
    if (Array.isArray(goals) && goals.some((g) => String(g).trim().length > 0)) {
      intentionDays.add(String(row.date));
    }
  }

  const secondsByDate: Record<string, number> = {};
  for (const row of events ?? []) {
    const ds = String(row.date ?? "");
    if (!ds) continue;
    secondsByDate[ds] = (secondsByDate[ds] ?? 0) + Number(row.duration_sec ?? 0);
  }

  function countStreak(isGoodDay: (ds: string) => boolean) {
    let streak = 0;
    for (let i = 0; i < lookbackDays; i++) {
      const ds = utcDateStringDaysAgo(i);
      if (isGoodDay(ds)) streak += 1;
      else break;
    }
    return streak;
  }

  return {
    intention_streak: countStreak((ds) => intentionDays.has(ds)),
    tracking_streak: countStreak((ds) => (secondsByDate[ds] ?? 0) >= TRACKING_MIN_SEC_PER_DAY),
    tracking_min_sec_per_day: TRACKING_MIN_SEC_PER_DAY,
  };
}
