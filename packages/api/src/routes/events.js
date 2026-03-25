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

const router = Router();

const eventItem = z.object({
  domain: z.string().min(1).max(512),
  title: z.string().max(2000).optional().nullable(),
  start_time: z.string(),
  end_time: z.string().optional().nullable(),
  category: z.string().max(64).optional(),
});

const batchSchema = z.object({
  events: z.array(eventItem).min(1).max(500),
});

const summaryQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function parseIso(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Free tier: only last 7 days of calendar dates from UTC "today" */
function isDateAllowedForFreeUser(requestedDateStr) {
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const [y, m, d] = requestedDateStr.split("-").map(Number);
  const req = new Date(Date.UTC(y, m - 1, d));
  return req >= cutoff;
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
      return {
        user_id: userId,
        domain: e.domain,
        title: e.title ?? null,
        start_time: start,
        end_time: end,
        category,
      };
    });

    const { error } = await supabaseAdmin.from("tab_events").insert(rows);
    if (error) return res.status(400).json({ error: error.message });

    return res.json({ data: { inserted: rows.length } });
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
router.delete("/me/activity/segments/:eventId", requireAuth, async (req, res, next) => {
  try {
    const eventId = req.params.eventId;
    if (!z.string().uuid().safeParse(eventId).success) {
      return res.status(400).json({ error: "Invalid event id" });
    }
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
});

export default router;
