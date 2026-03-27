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

const adminCompanySizeEnum = z.enum(["1", "2-10", "11-50", "51-200", "201+", "prefer_not_say"]);

function adminNullableTrimmed(max) {
  return z
    .union([z.string().max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const t = String(v).trim();
      return t === "" ? null : t;
    });
}

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
    display_name: adminNullableTrimmed(120),
    birth_year: z
      .union([z.coerce.number().int().min(1900).max(new Date().getFullYear()), z.null()])
      .optional(),
    country_code: z
      .union([
        z.string().length(2).regex(/^[A-Za-z]{2}$/),
        z.literal(""),
        z.null(),
      ])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null || v === "") return null;
        return String(v).toUpperCase();
      }),
    locale: adminNullableTrimmed(35),
    gender_identity: adminNullableTrimmed(80),
    occupation: adminNullableTrimmed(100),
    industry: adminNullableTrimmed(100),
    work_role: adminNullableTrimmed(80),
    company_size: z
      .union([adminCompanySizeEnum, z.literal(""), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === "" || v === null) return null;
        return v;
      }),
    primary_use_case: adminNullableTrimmed(200),
    referral_source: adminNullableTrimmed(100),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" });

const ADMIN_DEMO_KEYS = new Set([
  "display_name",
  "birth_year",
  "country_code",
  "locale",
  "gender_identity",
  "occupation",
  "industry",
  "work_role",
  "company_size",
  "primary_use_case",
  "referral_source",
]);

const patchIntentionBody = z
  .object({
    goals: z.array(z.string()).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((d) => d.goals !== undefined || d.date !== undefined, {
    message: "Provide goals and/or date",
  });

const reportTopDomainRow = z.object({
  domain: z.string().min(1).max(512),
  seconds: z.coerce.number().min(0).max(1_000_000_000),
  category: z.string().max(64).optional(),
});

const patchReportBody = z
  .object({
    ai_summary: z.string().min(1).optional(),
    score: z.union([z.coerce.number().int().min(1).max(10), z.null()]).optional(),
    top_domains: z.array(reportTopDomainRow).max(50).optional(),
    goals_met: z.array(z.string().max(500)).max(100).optional(),
    goals_missed: z.array(z.string().max(500)).max(100).optional(),
  })
  .strict();

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
      .select("id, email, display_name, country_code, app_role, license_active, created_at", { count: "exact" })
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
 * Aggregate audience, survey breakdowns, logins, domain trends (last 30d UTC). **Elevated staff**
 */
router.get("/analytics/audience", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_audience_dashboard");
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: data ?? {} });
  } catch (e) {
    next(e);
  }
});

/**
 * Daily time series for charts (signups, logins, tab minutes, etc.). Query: `days` 7–366 (default 90). **Elevated staff**
 */
router.get("/analytics/trends", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const raw = Number.parseInt(String(req.query.days ?? "90"), 10);
    const days = Number.isFinite(raw) ? Math.min(366, Math.max(7, raw)) : 90;
    const { data, error } = await supabaseAdmin.rpc("admin_analytics_timeseries", { p_days: days });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: data ?? {} });
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
 * Login / signup audit trail for a user. **Elevated staff**
 */
router.get("/users/:userId/login-events", requireAuth, requireElevatedStaff, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) return res.status(400).json({ error: "Invalid user id" });
    if (!(await ensureProfileExists(res, userId))) return;

    const { limit, offset } = parsePagination(req.query, 50, 200);
    const { data, error, count } = await supabaseAdmin
      .from("login_events")
      .select("id, occurred_at, event_type, provider, user_agent, ip_hash", { count: "exact" })
      .eq("user_id", userId)
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      data: {
        events: data ?? [],
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
    if (b.display_name !== undefined) patch.display_name = b.display_name;
    if (b.birth_year !== undefined) patch.birth_year = b.birth_year;
    if (b.country_code !== undefined) patch.country_code = b.country_code;
    if (b.locale !== undefined) patch.locale = b.locale;
    if (b.gender_identity !== undefined) patch.gender_identity = b.gender_identity;
    if (b.occupation !== undefined) patch.occupation = b.occupation;
    if (b.industry !== undefined) patch.industry = b.industry;
    if (b.work_role !== undefined) patch.work_role = b.work_role;
    if (b.company_size !== undefined) patch.company_size = b.company_size;
    if (b.primary_use_case !== undefined) patch.primary_use_case = b.primary_use_case;
    if (b.referral_source !== undefined) patch.referral_source = b.referral_source;

    const demoTouched = Object.keys(parsed.data).some((k) => ADMIN_DEMO_KEYS.has(k));
    if (demoTouched) patch.demographics_updated_at = new Date().toISOString();

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
