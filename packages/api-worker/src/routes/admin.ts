import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireElevatedStaff } from "../middleware/roles";
import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";
import {
  optionalDateParam,
  parseTabEventFilters,
  parseTabEventSort,
  buildFilteredTabEventsSelect,
  parseTabEventPagination,
  fetchTabEventSummary,
} from "../lib/tab-event-activity";
import { normalizeHostname } from "../utils";

const appRoleSchema = z.enum(["user", "admin", "developer"]);

function normalizeHostnameArray(arr: string[]) {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const line of arr) {
    const h = normalizeHostname(line);
    if (h && !seen.has(h)) {
      seen.add(h);
      list.push(h);
    }
  }
  return list;
}

const patchRoleBody = z.object({ app_role: appRoleSchema });

const nullableShortText = z
  .union([z.string().max(500), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" ? null : v));

const adminCompanySizeEnum = z.enum(["1", "2-10", "11-50", "51-200", "201+", "prefer_not_say"]);

function adminNullableTrimmed(max: number) {
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
    app_role: appRoleSchema.optional(),
    distraction_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
    blocked_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
    intent_lock_enabled: z.boolean().optional(),
    weekly_digest_enabled: z.boolean().optional(),
    send_tab_titles: z.boolean().optional(),
    team_slug: nullableShortText,
    leaderboard_opt_in: z.boolean().optional(),
    leaderboard_nickname: z.union([z.string().max(80), z.literal(""), z.null()]).optional(),
    display_name: adminNullableTrimmed(120),
    birth_year: z.union([z.coerce.number().int().min(1900).max(new Date().getFullYear()), z.null()]).optional(),
    country_code: z
      .union([z.string().length(2).regex(/^[A-Za-z]{2}$/), z.literal(""), z.null()])
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
  .refine((d) => d.goals !== undefined || d.date !== undefined, { message: "Provide goals and/or date" });

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

function parseListQuery(query: Record<string, string | undefined>) {
  const rawQ = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const q = rawQ.replace(/[%_\\]/g, "");
  const limitRaw = Number.parseInt(String(query.limit ?? "50"), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { q, limit, offset };
}

function parsePagination(query: Record<string, string | undefined>, defaultLimit = 50, maxLimit = 150) {
  const limitRaw = Number.parseInt(String(query.limit ?? String(defaultLimit)), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(maxLimit, Math.max(1, limitRaw)) : defaultLimit;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { limit, offset };
}

function isUuid(value: string) {
  return z.string().uuid().safeParse(value).success;
}

async function ensureProfileExists(c: { env: WorkerEnv; json: (body: unknown, status?: number) => Response }, userId: string) {
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: "User not found" }, 404);
  return null;
}

const admin = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

admin.get("/users", requireAuth, requireElevatedStaff, async (c) => {
  const { q, limit, offset } = parseListQuery(c.req.query());
  const supabaseAdmin = createSupabaseAdmin(c.env);
  let qb = supabaseAdmin
    .from("profiles")
    .select("id, email, display_name, country_code, app_role, license_active, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (q) qb = qb.ilike("email", `%${q}%`);
  const { data, error, count } = await qb;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { users: data ?? [], total: count ?? 0, limit, offset } });
});

admin.get("/analytics/audience", requireAuth, requireElevatedStaff, async (c) => {
  const { data, error } = await createSupabaseAdmin(c.env).rpc("admin_audience_dashboard");
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: data ?? {} });
});

admin.get("/analytics/trends", requireAuth, requireElevatedStaff, async (c) => {
  const raw = Number.parseInt(String(c.req.query("days") ?? "90"), 10);
  const days = Number.isFinite(raw) ? Math.min(366, Math.max(7, raw)) : 90;
  const { data, error } = await createSupabaseAdmin(c.env).rpc("admin_analytics_timeseries", { p_days: days });
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: data ?? {} });
});

admin.get("/users/:userId", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).single();
  if (error || !profile) return c.json({ error: "User not found" }, 404);

  const [intentions, tab_events, reports, payments] = await Promise.all([
    supabaseAdmin.from("intentions").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("tab_events").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("reports").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabaseAdmin.from("payments").select("*", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return c.json({
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
});

admin.get("/users/:userId/login-events", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;
  const { limit, offset } = parsePagination(c.req.query(), 50, 200);
  const { data, error, count } = await createSupabaseAdmin(c.env)
    .from("login_events")
    .select("id, occurred_at, event_type, provider, user_agent, ip_hash", { count: "exact" })
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { events: data ?? [], total: count ?? 0, limit, offset } });
});

admin.patch("/users/:userId", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const parsed = adminPatchProfileBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  const b = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.hourly_rate !== undefined) patch.hourly_rate = b.hourly_rate;
  if (b.timezone !== undefined) patch.timezone = b.timezone;
  if (b.license_active !== undefined) patch.license_active = b.license_active;
  if (b.stripe_customer_id !== undefined) patch.stripe_customer_id = b.stripe_customer_id;
  if (b.license_key !== undefined) patch.license_key = b.license_key;
  if (b.app_role !== undefined) patch.app_role = b.app_role;
  if (b.email !== undefined) {
    const supabaseAdmin = createSupabaseAdmin(c.env);
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { email: b.email });
    if (authErr) return c.json({ error: authErr.message }, 400);
    patch.email = b.email;
  }
    if (b.distraction_domains !== undefined) patch.distraction_domains = b.distraction_domains;
    if (b.blocked_domains !== undefined) patch.blocked_domains = normalizeHostnameArray(b.blocked_domains);
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

  const { data, error } = await createSupabaseAdmin(c.env).from("profiles").update(patch).eq("id", userId).select("*").single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

admin.patch("/users/:userId/role", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const parsed = patchRoleBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("profiles")
    .update({ app_role: parsed.data.app_role, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, email, app_role")
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

admin.get("/users/:userId/intentions", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;

  const q = c.req.query();
  const { limit, offset } = parsePagination(q, 40, 100);
  const from = optionalDateParam(q, "from");
  const to = optionalDateParam(q, "to");
  const supabaseAdmin = createSupabaseAdmin(c.env);
  let qb = supabaseAdmin
    .from("intentions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);
  if (from) qb = qb.gte("date", from);
  if (to) qb = qb.lte("date", to);
  const { data, error, count } = await qb;
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { intentions: data ?? [], total: count ?? 0, limit, offset } });
});

admin.get("/users/:userId/tab-events/summary", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;
  const filters = parseTabEventFilters(c.req.query());
  const data = await fetchTabEventSummary(c.env, userId, filters);
  return c.json({ data });
});

admin.get("/users/:userId/tab-events", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;
  const q = c.req.query();
  const { limit, offset } = parseTabEventPagination(q, 40, 150);
  const filters = parseTabEventFilters(q);
  const sort = parseTabEventSort(q);
  const { data, error, count } = await buildFilteredTabEventsSelect(c.env, userId, filters, "*", { count: "exact" })
    .order(sort.column, { ascending: sort.ascending })
    .range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { tab_events: data ?? [], total: count ?? 0, limit, offset } });
});

admin.get("/users/:userId/reports", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;
  const { limit, offset } = parsePagination(c.req.query(), 40, 100);
  const { data, error, count } = await createSupabaseAdmin(c.env)
    .from("reports")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { reports: data ?? [], total: count ?? 0, limit, offset } });
});

admin.get("/users/:userId/payments", requireAuth, requireElevatedStaff, async (c) => {
  const userId = c.req.param("userId");
  if (!isUuid(userId)) return c.json({ error: "Invalid user id" }, 400);
  const missing = await ensureProfileExists(c, userId);
  if (missing) return missing;
  const { limit, offset } = parsePagination(c.req.query(), 40, 100);
  const { data, error, count } = await createSupabaseAdmin(c.env)
    .from("payments")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: { payments: data ?? [], total: count ?? 0, limit, offset } });
});

admin.patch("/intentions/:intentionId", requireAuth, requireElevatedStaff, async (c) => {
  const intentionId = c.req.param("intentionId");
  if (!isUuid(intentionId)) return c.json({ error: "Invalid intention id" }, 400);
  const parsed = patchIntentionBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  const update: Record<string, unknown> = {};
  if (parsed.data.goals !== undefined) update.goals = parsed.data.goals;
  if (parsed.data.date !== undefined) update.date = parsed.data.date;
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("intentions")
    .update(update)
    .eq("id", intentionId)
    .select("*")
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json({ data });
});

admin.delete("/intentions/:intentionId", requireAuth, requireElevatedStaff, async (c) => {
  const intentionId = c.req.param("intentionId");
  if (!isUuid(intentionId)) return c.json({ error: "Invalid intention id" }, 400);
  const { data, error } = await createSupabaseAdmin(c.env).from("intentions").delete().eq("id", intentionId).select("id");
  if (error) return c.json({ error: error.message }, 400);
  if (!data?.length) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

admin.delete("/tab-events/:eventId", requireAuth, requireElevatedStaff, async (c) => {
  const eventId = c.req.param("eventId");
  if (!isUuid(eventId)) return c.json({ error: "Invalid event id" }, 400);
  const { data, error } = await createSupabaseAdmin(c.env).from("tab_events").delete().eq("id", eventId).select("id");
  if (error) return c.json({ error: error.message }, 400);
  if (!data?.length) return c.json({ error: "Not found" }, 404);
  return c.body(null, 204);
});

admin.patch("/reports/:reportId", requireAuth, requireElevatedStaff, async (c) => {
  const reportId = c.req.param("reportId");
  if (!isUuid(reportId)) return c.json({ error: "Invalid report id" }, 400);
  const parsed = patchReportBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: parsed.error.issues.map((i) => i.message).join("; ") }, 400);
  const u = parsed.data;
  const update: Record<string, unknown> = {};
  if (u.ai_summary !== undefined) update.ai_summary = u.ai_summary;
  if (u.score !== undefined) update.score = u.score;
  if (u.top_domains !== undefined) update.top_domains = u.top_domains;
  if (u.goals_met !== undefined) update.goals_met = u.goals_met;
  if (u.goals_missed !== undefined) update.goals_missed = u.goals_missed;
  if (Object.keys(update).length === 0) return c.json({ error: "Provide at least one field" }, 400);
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("reports")
    .update(update)
    .eq("id", reportId)
    .select("*")
    .single();
  if (error) return c.json({ error: error.message }, 400);
  if (!data) return c.json({ error: "Not found" }, 404);
  return c.json({ data });
});

export default admin;
