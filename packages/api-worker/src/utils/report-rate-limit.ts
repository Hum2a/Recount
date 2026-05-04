import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerEnv } from "../env";

export function utcDayBoundsIso(): { startIso: string; endIso: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start.getTime() + 86400000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function countReportGenerationsThisUtcDay(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<{ count: number; error: Error | null }> {
  const { startIso, endIso } = utcDayBoundsIso();
  const { count, error } = await supabaseAdmin
    .from("report_generation_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  if (error) return { count: 0, error: new Error(error.message) };
  return { count: count ?? 0, error: null };
}

export async function insertReportGenerateEvent(
  supabaseAdmin: SupabaseClient,
  userId: string,
  targetDate: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("report_generation_events").insert({
    user_id: userId,
    target_date: targetDate,
  });
  if (error) throw new Error(error.message);
}

export function maxReportGenerationsPerUtcDay(env: WorkerEnv): number {
  const raw = env.REPORT_GENERATE_MAX_PER_UTC_DAY;
  if (raw === undefined || raw === null || String(raw).trim() === "") return 15;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(500, Math.max(1, Math.floor(n))) : 15;
}
