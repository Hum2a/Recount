import { Router } from "express";
import { z } from "zod";
import { APP_ROLES } from "@recount/shared";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { requireElevatedStaff } from "../middleware/roles.js";
import {
  optionalDateParam,
  parseTabEventFilters,
  parseTabEventSort,
  buildFilteredTabEventsSelect,
  parseTabEventPagination,
  fetchTabEventSummary,
} from "../lib/tab-event-activity.js";

const router = Router();

const patchRoleBody = z.object({
  app_role: z.enum([...APP_ROLES]),
});

const nullableShortText = z
  .union([z.string().max(500), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const adminPatchProfileBody = z
  .object({
    email: z.string().email().optional(),
    hourly_rate: z.coerce.number().min(0).max(99999999).optional(),
    timezone: z.string().min(1).max(100).optional(),
    license_active: z.boolean().optional(),
    stripe_customer_id: nullableShortText,
    license_key: nullableShortText,
    app_role: z.enum([...APP_ROLES]).optional(),
    distraction_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
    intent_lock_enabled: z.boolean().optional(),
    weekly_digest_enabled: z.boolean().optional(),
    send_tab_titles: z.boolean().optional(),
    team_slug: nullableShortText,
    leaderboard_opt_in: z.boolean().optional(),
    leaderboard_nickname: z.union([z.string().max(80), z.literal(""), z.null()]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" });

const patchIntentionBody = z
  .object({
    goals: z.array(z.string()).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((d) => d.goals !== undefined || d.date !== undefined, {
    message: "Provide goals and/or date",
  });

const patchReportBody = z.object({
  ai_summary: z.string().min(1).optional(),
  score: z.union([z.coerce.number().int().min(1).max(10), z.null()]).optional(),
  top_domains: z.any().optional(),
  goals_met: z.array(z.string()).optional(),
  goals_missed: z.array(z.string()).optional(),
});

function parseListQuery(query) {
  const rawQ = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const q = rawQ.replace(/[%_\\]/g, "");
  const limitRaw = Number.parseInt(String(query.limit ?? "50"), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { q, limit, offset };
}

function parsePagination(query, defaultLimit = 50, maxLimit = 150) {
  const limitRaw = Number.parseInt(String(query.limit ?? String(defaultLimit)), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(maxLimit, Math.max(1, limitRaw)) : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { limit, offset };
}

function isUuid(value) {
  return z.string().uuid().safeParse(value).success;
}

async function ensureProfileExists(res, userId) {
  const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) {
    res.status(400).json({ error: error.message });
    return false;
  }
  if (!data) {
    res.status(404).json({ error: "User not found" });
    return false;
  }
  return true;
}

/**
 * Paginated profile list for staff. **Admin or developer** (elevated staff).
 */
router.get("/users", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { q, limit, offset } = parseListQuery(req.query);

    let qb = supabaseAdmin
      .from("profiles")
      .select("id, email, app_role, license_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) qb = qb.ilike("email", `%${q}%`);

    const { data, error, count } = await qb;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      data: {
        users: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Full profile + row counts per table. **Elevated staff**
 */
router.get("/users/:userId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });

    const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).single();
    if (error || !profile) return res.status(404).json({ error: "User not found" });

    const [intentions, tab_events, reports, payments] = await Promise.all([
      supabaseAdmin.from("intentions").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("tab_events").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("reports").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabaseAdmin.from("payments").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);

    return res.json({
      data: {
        profile,
        counts: {
          intentions: intentions.count ?? 0,
          tab_events: tab_events.count ?? 0,
          reports: reports.count ?? 0,
          payments: payments.count ?? 0,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Partial profile update (billing, settings, email, role). **Elevated staff**
 */
router.patch("/users/:userId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });

    const parsed = adminPatchProfileBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const b = parsed.data;
    const patch = { updated_at: new Date().toISOString() };
    if (b.hourly_rate !== undefined) patch.hourly_rate = b.hourly_rate;
    if (b.timezone !== undefined) patch.timezone = b.timezone;
    if (b.license_active !== undefined) patch.license_active = b.license_active;
    if (b.stripe_customer_id !== undefined) patch.stripe_customer_id = b.stripe_customer_id;
    if (b.license_key !== undefined) patch.license_key = b.license_key;
    if (b.app_role !== undefined) patch.app_role = b.app_role;
    if (b.email !== undefined) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: b.email });
      if (authErr) return res.status(400).json({ error: authErr.message });
      patch.email = b.email;
    }
    if (b.distraction_domains !== undefined) patch.distraction_domains = b.distraction_domains;
    if (b.intent_lock_enabled !== undefined) patch.intent_lock_enabled = b.intent_lock_enabled;
    if (b.weekly_digest_enabled !== undefined) patch.weekly_digest_enabled = b.weekly_digest_enabled;
    if (b.send_tab_titles !== undefined) patch.send_tab_titles = b.send_tab_titles;
    if (b.team_slug !== undefined) patch.team_slug = b.team_slug;
    if (b.leaderboard_opt_in !== undefined) patch.leaderboard_opt_in = b.leaderboard_opt_in;
    if (b.leaderboard_nickname !== undefined) {
      patch.leaderboard_nickname =
        b.leaderboard_nickname && String(b.leaderboard_nickname).trim()
          ? String(b.leaderboard_nickname).trim().slice(0, 80)
          : null;
    }

    const { data, error } = await supabaseAdmin.from("profiles").update(patch).eq("id", userId).select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

/**
 * Change another user’s `app_role`. **Elevated staff**
 */
router.patch("/users/:userId/role", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    const parsed = patchRoleBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ app_role: parsed.data.app_role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, email, app_role")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

/** Intentions for a user. **Elevated staff** */
router.get("/users/:userId/intentions", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const { limit, offset } = parsePagination(req.query, 40, 100);
    const from = optionalDateParam(req.query, "from");
    const to = optionalDateParam(req.query, "to");

    let qb = supabaseAdmin
      .from("intentions")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) qb = qb.gte("date", from);
    if (to) qb = qb.lte("date", to);

    const { data, error, count } = await qb;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: { intentions: data ?? [], total: count ?? 0, limit, offset } });
  } catch (e) {
    next(e);
  }
});

/**
 * Aggregates for Activity tab (full dataset via SQL RPC when migration `006` is applied).
 * **Elevated staff**
 */
router.get("/users/:userId/tab-events/summary", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const filters = parseTabEventFilters(req.query);
    const data = await fetchTabEventSummary(userId, filters);
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

/** Tab events for a user (filters, sort, pagination). **Elevated staff** */
router.get("/users/:userId/tab-events", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const { limit, offset } = parseTabEventPagination(req.query, 40, 150);
    const filters = parseTabEventFilters(req.query);
    const sort = parseTabEventSort(req.query);

    let qb = buildFilteredTabEventsSelect(userId, filters, "*", { count: "exact" })
      .order(sort.column, { ascending: sort.ascending })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: { tab_events: data ?? [], total: count ?? 0, limit, offset } });
  } catch (e) {
    next(e);
  }
});

/** Reports for a user. **Elevated staff** */
router.get("/users/:userId/reports", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const { limit, offset } = parsePagination(req.query, 40, 100);

    const { data, error, count } = await supabaseAdmin
      .from("reports")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: { reports: data ?? [], total: count ?? 0, limit, offset } });
  } catch (e) {
    next(e);
  }
});

/** Payment rows for a user (read-only; amounts from Stripe). **Elevated staff** */
router.get("/users/:userId/payments", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const { limit, offset } = parsePagination(req.query, 40, 100);

    const { data, error, count } = await supabaseAdmin
      .from("payments")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: { payments: data ?? [], total: count ?? 0, limit, offset } });
  } catch (e) {
    next(e);
  }
});

/** Update one intention row. **Admin only** */
router.patch("/intentions/:intentionId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { intentionId } = req.params;
    if (!isUuid(intentionId)) return res.status(400).json({ error: "Invalid intention id" });

    const parsed = patchIntentionBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const update = {};
    if (parsed.data.goals !== undefined) update.goals = parsed.data.goals;
    if (parsed.data.date !== undefined) update.date = parsed.data.date;

    const { data, error } = await supabaseAdmin
      .from("intentions")
      .update(update)
      .eq("id", intentionId)
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

/** Delete one intention row. **Admin only** */
router.delete("/intentions/:intentionId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { intentionId } = req.params;
    if (!isUuid(intentionId)) return res.status(400).json({ error: "Invalid intention id" });

    const { data, error } = await supabaseAdmin.from("intentions").delete().eq("id", intentionId).select("id");
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

/** Delete one tab event row. **Admin only** */
router.delete("/tab-events/:eventId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event id" });

    const { data, error } = await supabaseAdmin.from("tab_events").delete().eq("id", eventId).select("id");
    if (error) return res.status(400).json({ error: error.message });
    if (!data?.length) return res.status(404).json({ error: "Not found" });
    return res.status(204).send();
  } catch (e) {
    next(e);
  }
});

/** Update one report row. **Admin only** */
router.patch("/reports/:reportId", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { reportId } = req.params;
    if (!isUuid(reportId)) return res.status(400).json({ error: "Invalid report id" });

    const parsed = patchReportBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }
    const u = parsed.data;
    const update = {};
    if (u.ai_summary !== undefined) update.ai_summary = u.ai_summary;
    if (u.score !== undefined) update.score = u.score;
    if (u.top_domains !== undefined) update.top_domains = u.top_domains;
    if (u.goals_met !== undefined) update.goals_met = u.goals_met;
    if (u.goals_missed !== undefined) update.goals_missed = u.goals_missed;
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Provide at least one field" });
    }

    const { data, error } = await supabaseAdmin
      .from("reports")
      .update(update)
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Not found" });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

export default router;
