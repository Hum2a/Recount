import { Router } from "express";
import { z } from "zod";
import { classifyDomain } from "@recount/shared";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth, userHasLicense } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  parseTabEventFilters,
  parseTabEventSort,
  buildFilteredTabEventsSelect,
  parseTabEventPagination,
  fetchTabEventSummary,
  applyFreeTierActivityWindow,
} from "../lib/tab-event-activity.js";
import { buildIcsCalendar } from "../lib/ics.js";

const router = Router();

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

const eventIdParams = z
  .object({
    eventId: z.string().uuid(),
  })
  .strict();

function parseIso(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function utcTodayMidnight() {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

/** Free tier: only last 7 days of calendar dates from UTC "today" */
function isDateAllowedForFreeUser(requestedDateStr) {
  const cutoff = utcTodayMidnight();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const [y, m, d] = requestedDateStr.split("-").map(Number);
  const req = new Date(Date.UTC(y, m - 1, d));
  return req >= cutoff;
}

/** @param {string} a @param {string} b YYYY-MM-DD */
function compareYmd(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** @param {string} ymd @param {number} deltaDays */
function addUtcDays(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * @returns {{ from: string, to: string }}
 */
function resolveCalendarRange(query, licensed) {
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

router.post("/batch", requireAuth, validate(batchSchema), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rows = req.validated.events.map((e) => {
      const start = parseIso(e.start_time);
      if (!start) throw Object.assign(new Error("Invalid start_time"), { status: 400 });
      const end = e.end_time ? parseIso(e.end_time) : null;
      if (e.end_time && !end) throw Object.assign(new Error("Invalid end_time"), { status: 400 });
      const category = e.category ?? classifyDomain(e.domain);
      const row = {
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

    const { error } = await supabaseAdmin.from("tab_events").insert(rows);
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ data: { inserted: rows.length } });
  } catch (e) {
    next(e);
  }
});

/**
 * iCalendar feed of daily tracked totals (UTC dates).
 * Auth: session Bearer only (no query-token secrets). If you add shareable URLs later,
 * use opaque revocable tokens + TTL — never long-lived JWTs in query strings (cf. SEC-019).
 */
router.get("/me/calendar.ics", requireAuth, validate(calendarQuery, "query"), async (req, res, next) => {
  try {
    const licensed = await userHasLicense(req.user.id);
    const { from, to } = resolveCalendarRange(req.validated, licensed);

    const { data, error } = await supabaseAdmin
      .from("tab_events")
      .select("date, duration_sec")
      .eq("user_id", req.user.id)
      .gte("date", from)
      .lte("date", to);

    if (error) return res.status(400).json({ error: error.message });

    /** @type {Record<string, number>} */
    const secByDate = {};
    for (const row of data ?? []) {
      const ds = row.date;
      if (!ds) continue;
      secByDate[ds] = (secByDate[ds] ?? 0) + (row.duration_sec ?? 0);
    }

    const events = [];
    for (let cur = from; compareYmd(cur, to) <= 0; cur = addUtcDays(cur, 1)) {
      const sec = secByDate[cur] ?? 0;
      if (sec <= 0) continue;
      const m = Math.round(sec / 60);
      const summary = m < 60 ? `Recount: ${m}m tracked` : `Recount: ${Math.floor(m / 60)}h ${m % 60}m tracked`;
      events.push({
        uid: `recount-${req.user.id}-${cur}@recount`,
        date: cur,
        summary,
      });
    }

    const body = buildIcsCalendar("-//Recount//Recount Calendar//EN", events);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="recount-activity.ics"');
    return res.send(body);
  } catch (e) {
    next(e);
  }
});

router.get("/summary", requireAuth, validate(summaryQuery, "query"), async (req, res, next) => {
  try {
    const { date } = req.validated;
    const licensed = await userHasLicense(req.user.id);
    if (!licensed && !isDateAllowedForFreeUser(date)) {
      return res.status(403).json({ error: "Free plan limited to the last 7 days" });
    }

    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;

    const { data, error } = await supabaseAdmin
      .from("tab_events")
      .select("domain, duration_sec, category")
      .eq("user_id", req.user.id)
      .gte("start_time", start)
      .lte("start_time", end);

    if (error) return res.status(400).json({ error: error.message });

    /** @type {Record<string, { seconds: number, category: string }>} */
    const byDomain = {};
    for (const row of data ?? []) {
      const sec = row.duration_sec ?? 0;
      if (!byDomain[row.domain]) {
        byDomain[row.domain] = { seconds: 0, category: row.category ?? "other" };
      }
      byDomain[row.domain].seconds += sec;
    }

    const domains = Object.entries(byDomain)
      .map(([domain, v]) => ({ domain, seconds: v.seconds, category: v.category }))
      .sort((a, b) => b.seconds - a.seconds);

    const totalActiveSec = domains.reduce((s, d) => s + d.seconds, 0);

    return res.json({
      data: {
        date,
        total_active_sec: totalActiveSec,
        domains,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Your own activity analytics (same aggregates as staff Activity tab). Free plan: last 7 UTC days only.
 */
router.get("/me/activity/summary", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const licensed = await userHasLicense(userId);
    let filters = parseTabEventFilters(req.query);
    filters = applyFreeTierActivityWindow(filters, licensed);
    const data = await fetchTabEventSummary(userId, filters);
    return res.json({
      data,
      meta: { license_active: licensed, activity_history_days: licensed ? null : 7 },
    });
  } catch (e) {
    next(e);
  }
});

/** Paginated tab segments for the signed-in user (filters + sort). Free plan: last 7 UTC days only. */
router.get("/me/activity/segments", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const licensed = await userHasLicense(userId);
    let filters = parseTabEventFilters(req.query);
    filters = applyFreeTierActivityWindow(filters, licensed);
    const { limit, offset } = parseTabEventPagination(req.query, 40, 150);
    const sort = parseTabEventSort(req.query);

    const { data, error, count } = await buildFilteredTabEventsSelect(userId, filters, "*", { count: "exact" })
      .order(sort.column, { ascending: sort.ascending })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: { tab_events: data ?? [], total: count ?? 0, limit, offset } });
  } catch (e) {
    next(e);
  }
});

/** Delete one of your own tab events (e.g. privacy cleanup). */
router.delete(
  "/me/activity/segments/:eventId",
  requireAuth,
  validate(eventIdParams, "params"),
  async (req, res, next) => {
  try {
    const { eventId } = req.validated;
    const { data, error } = await supabaseAdmin
      .from("tab_events")
      .delete()
      .eq("id", eventId)
      .eq("user_id", req.user.id)
      .select("id");
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
}
);

export default router;
