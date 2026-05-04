import { env } from "../config/env.js";

export function utcDayBoundsIso() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start.getTime() + 86400000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/**
 * @param {unknown} supabaseAdmin Supabase client (service role).
 * @param {string} userId
 */
export async function countReportGenerationsThisUtcDay(supabaseAdmin, userId) {
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

/**
 * @param {unknown} supabaseAdmin Supabase client (service role).
 * @param {string} userId
 * @param {string} targetDate YYYY-MM-DD
 */
export async function insertReportGenerateEvent(supabaseAdmin, userId, targetDate) {
  const { error } = await supabaseAdmin.from("report_generation_events").insert({
    user_id: userId,
    target_date: targetDate,
  });
  if (error) throw new Error(error.message);
}

/** @returns {number} */
export function maxReportGenerationsPerUtcDay() {
  return env.REPORT_GENERATE_MAX_PER_UTC_DAY;
}
