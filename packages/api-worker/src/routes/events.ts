import { Hono } from "hono";
import { z } from "zod";
import { classifyDomain } from "@recount/shared";
import { requireAuth, userHasLicensedOrStaffAccess } from "../middleware/auth";
import { createSupabaseAdmin } from "../supabase";
import { buildIcsCalendar } from "../lib/ics";
import {
  applyFreeTierActivityWindow,
  buildFilteredTabEventsSelect,
  fetchTabEventSummary,
  parseTabEventFilters,
  parseTabEventPagination,
  parseTabEventSort,
} from "../lib/tab-event-activity";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";
import { zodErrorMessage } from "../utils";

const eventItem = z.object({
  domain: z.string().min(1).max(512),
  title: z.string().max(2000).optional().nullable(),
  start_time: z.string(),
  end_time: z.string().optional().nullable(),
  category: z.string().max(64).optional(),
  focus_session_id: z.string().uuid().optional().nullable(),
});

const batchSchema = z.object({
  events: z.array(eventItem).min(1).max(500),
});

const summaryQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const calendarQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function parseIso(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function utcTodayMidnight() {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

function isDateAllowedForFreeUser(requestedDateStr: string) {
  const cutoff = utcTodayMidnight();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const [y, m, d] = requestedDateStr.split("-").map(Number);
  const req = new Date(Date.UTC(y, m - 1, d));
  return req >= cutoff;
}

function compareYmd(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function addUtcDays(ymd: string, deltaDays: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function resolveCalendarRange(query: { from?: string; to?: string }, licensed: boolean) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let to = query.to ?? todayStr;
  let from = query.from ?? (licensed ? addUtcDays(to, -29) : addUtcDays(to, -6));
  if (compareYmd(from, to) > 0) {
    const t = from;
    from = to;
    to = t;
  }
  if (!licensed) {
    const cutoff = utcTodayMidnight();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    if (compareYmd(from, cutoffStr) < 0) from = cutoffStr;
    if (compareYmd(to, todayStr) > 0) to = todayStr;
  } else {
    const maxStart = addUtcDays(to, -365);
    if (compareYmd(from, maxStart) < 0) from = maxStart;
    if (compareYmd(to, todayStr) > 0) to = todayStr;
  }
  return { from, to };
}

const events = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

events.post("/batch", requireAuth, async (c) => {
  const parsed = batchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const userId = c.get("user").id;
  const rows = parsed.data.events.map((e) => {
    const start = parseIso(e.start_time);
    if (!start) throw Object.assign(new Error("Invalid start_time"), { status: 400 });
    const end = e.end_time ? parseIso(e.end_time) : null;
    if (e.end_time && !end) throw Object.assign(new Error("Invalid end_time"), { status: 400 });
    const category = e.category ?? classifyDomain(e.domain);
    const row: Record<string, unknown> = {
      user_id: userId,
      domain: e.domain,
      title: e.title ?? null,
      start_time: start,
      end_time: end,
      category,
    };
    if (e.focus_session_id) row.focus_session_id = e.focus_session_id;
    return row;
  });
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { error } = await supabaseAdmin.from("tab_events").insert(rows);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { inserted: rows.length } });
});

events.get("/me/calendar.ics", requireAuth, async (c) => {
  const parsed = calendarQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const userId = c.get("user").id;
  const licensed = await userHasLicensedOrStaffAccess(c.env, userId);
  const { from, to } = resolveCalendarRange(parsed.data, licensed);
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin
    .from("tab_events")
    .select("date, duration_sec")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (error) return c.json({ error: error.message }, 400);

  const secByDate: Record<string, number> = {};
  for (const row of data ?? []) {
    const ds = row.date as string | null;
    if (!ds) continue;
    secByDate[ds] = (secByDate[ds] ?? 0) + Number(row.duration_sec ?? 0);
  }

  const icsEvents: Array<{ uid: string; date: string; summary: string }> = [];
  for (let cur = from; compareYmd(cur, to) <= 0; cur = addUtcDays(cur, 1)) {
    const sec = secByDate[cur] ?? 0;
    if (sec <= 0) continue;
    const m = Math.round(sec / 60);
    const summary = m < 60 ? `Recount: ${m}m tracked` : `Recount: ${Math.floor(m / 60)}h ${m % 60}m tracked`;
    icsEvents.push({
      uid: `recount-${userId}-${cur}@recount`,
      date: cur,
      summary,
    });
  }

  const body = buildIcsCalendar("-//Recount//Recount Calendar//EN", icsEvents);
  c.header("Content-Type", "text/calendar; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="recount-activity.ics"');
  return c.body(body);
});

events.get("/summary", requireAuth, async (c) => {
  const parsed = summaryQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const { date } = parsed.data;
  const userId = c.get("user").id;
  const licensed = await userHasLicensedOrStaffAccess(c.env, userId);
  if (!licensed && !isDateAllowedForFreeUser(date)) return c.json({ error: "Free plan limited to the last 7 days" }, 403);

  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin
    .from("tab_events")
    .select("domain, duration_sec, category")
    .eq("user_id", userId)
    .gte("start_time", start)
    .lte("start_time", end);
  if (error) return c.json({ error: error.message }, 400);

  const byDomain: Record<string, { seconds: number; category: string }> = {};
  for (const row of data ?? []) {
    const domain = String(row.domain ?? "");
    const sec = Number(row.duration_sec ?? 0);
    if (!byDomain[domain]) byDomain[domain] = { seconds: 0, category: String(row.category ?? "other") };
    byDomain[domain].seconds += sec;
  }
  const domains = Object.entries(byDomain)
    .map(([domain, v]) => ({ domain, seconds: v.seconds, category: v.category }))
    .sort((a, b) => b.seconds - a.seconds);
  const totalActiveSec = domains.reduce((s, d) => s + d.seconds, 0);
  return c.json({ data: { date, total_active_sec: totalActiveSec, domains } });
});

events.get("/me/activity/summary", requireAuth, async (c) => {
  const userId = c.get("user").id;
  const licensed = await userHasLicensedOrStaffAccess(c.env, userId);
  let filters = parseTabEventFilters(c.req.query());
  filters = applyFreeTierActivityWindow(filters, licensed);
  const data = await fetchTabEventSummary(c.env, userId, filters);
  return c.json({
    data,
    meta: { license_active: licensed, activity_history_days: licensed ? null : 7 },
  });
});

events.get("/me/activity/segments", requireAuth, async (c) => {
  const userId = c.get("user").id;
  const licensed = await userHasLicensedOrStaffAccess(c.env, userId);
  let filters = parseTabEventFilters(c.req.query());
  filters = applyFreeTierActivityWindow(filters, licensed);
  const { limit, offset } = parseTabEventPagination(c.req.query(), 40, 150);
  const sort = parseTabEventSort(c.req.query());
  const { data, error, count } = await buildFilteredTabEventsSelect(c.env, userId, filters, "*", { count: "exact" })
    .order(sort.column, { ascending: sort.ascending })
    .range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { tab_events: data ?? [], total: count ?? 0, limit, offset } });
});

events.delete("/me/activity/segments/:eventId", requireAuth, async (c) => {
  const eventId = c.req.param("eventId");
  if (!z.string().uuid().safeParse(eventId).success) return c.json({ error: "Invalid event id" }, 400);
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin
    .from("tab_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", c.get("user").id)
    .select("id");
  if (error) return c.json({ error: error.message }, 400);
  if (!data?.length) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

export default events;
