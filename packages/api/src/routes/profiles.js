import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { computeStreaksForUser } from "../lib/streaks.js";

const router = Router();

const companySizeEnum = z.enum(["1", "2-10", "11-50", "51-200", "201+", "prefer_not_say"]);

function nullableTrimmed(max) {
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

const patchSchema = z
  .object({
    hourly_rate: z.coerce.number().min(0).max(99999999).optional(),
    timezone: z.string().min(1).max(100).optional(),
    distraction_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
    blocked_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
    intent_lock_enabled: z.boolean().optional(),
    weekly_digest_enabled: z.boolean().optional(),
    send_tab_titles: z.boolean().optional(),
    team_slug: z
      .union([
        z
          .string()
          .min(2)
          .max(64)
          .regex(/^[a-z0-9-]+$/),
        z.literal(""),
        z.null(),
      ])
      .optional(),
    leaderboard_opt_in: z.boolean().optional(),
    leaderboard_nickname: z.union([z.string().max(80), z.literal(""), z.null()]).optional(),
    // Survey / demographics: every field optional; empty client values → null. Never required for product use.
    display_name: nullableTrimmed(120),
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
    locale: nullableTrimmed(35),
    gender_identity: nullableTrimmed(80),
    occupation: nullableTrimmed(100),
    industry: nullableTrimmed(100),
    work_role: nullableTrimmed(80),
    company_size: z
      .union([companySizeEnum, z.literal(""), z.null()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === "" || v === null) return null;
        return v;
      }),
    primary_use_case: nullableTrimmed(200),
    referral_source: nullableTrimmed(100),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" });

const DEMOGRAPHIC_PATCH_KEYS = new Set([
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

function normalizeHostname(line) {
  return String(line)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

const meSelect =
  "email, hourly_rate, timezone, license_active, app_role, distraction_domains, blocked_domains, intent_lock_enabled, weekly_digest_enabled, send_tab_titles, team_slug, leaderboard_opt_in, leaderboard_nickname, display_name, birth_year, country_code, locale, gender_identity, occupation, industry, work_role, company_size, primary_use_case, referral_source, demographics_updated_at";

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from("profiles").select(meSelect).eq("id", req.user.id).single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

router.get("/me/streaks", requireAuth, async (req, res, next) => {
  try {
    const streaks = await computeStreaksForUser(req.user.id);
    return res.json({ data: streaks });
  } catch (e) {
    next(e);
  }
});

router.patch("/", requireAuth, validate(patchSchema), async (req, res, next) => {
  try {
    const patch = {};
    const v = req.validated;
    if (v.hourly_rate !== undefined) patch.hourly_rate = v.hourly_rate;
    if (v.timezone !== undefined) patch.timezone = v.timezone;
    if (v.distraction_domains !== undefined) {
      const seen = new Set();
      const list = [];
      for (const line of v.distraction_domains) {
        const h = normalizeHostname(line);
        if (h && !seen.has(h)) {
          seen.add(h);
          list.push(h);
        }
      }
      patch.distraction_domains = list;
    }
    if (v.blocked_domains !== undefined) {
      const seen = new Set();
      const list = [];
      for (const line of v.blocked_domains) {
        const h = normalizeHostname(line);
        if (h && !seen.has(h)) {
          seen.add(h);
          list.push(h);
        }
      }
      patch.blocked_domains = list;
    }
    if (v.intent_lock_enabled !== undefined) patch.intent_lock_enabled = v.intent_lock_enabled;
    if (v.weekly_digest_enabled !== undefined) patch.weekly_digest_enabled = v.weekly_digest_enabled;
    if (v.send_tab_titles !== undefined) patch.send_tab_titles = v.send_tab_titles;
    if (v.team_slug !== undefined) {
      patch.team_slug = v.team_slug && String(v.team_slug).trim() ? String(v.team_slug).trim().toLowerCase() : null;
    }
    if (v.leaderboard_opt_in !== undefined) patch.leaderboard_opt_in = v.leaderboard_opt_in;
    if (v.leaderboard_nickname !== undefined) {
      patch.leaderboard_nickname =
        v.leaderboard_nickname && String(v.leaderboard_nickname).trim()
          ? String(v.leaderboard_nickname).trim().slice(0, 80)
          : null;
    }
    if (v.display_name !== undefined) patch.display_name = v.display_name;
    if (v.birth_year !== undefined) patch.birth_year = v.birth_year;
    if (v.country_code !== undefined) patch.country_code = v.country_code;
    if (v.locale !== undefined) patch.locale = v.locale;
    if (v.gender_identity !== undefined) patch.gender_identity = v.gender_identity;
    if (v.occupation !== undefined) patch.occupation = v.occupation;
    if (v.industry !== undefined) patch.industry = v.industry;
    if (v.work_role !== undefined) patch.work_role = v.work_role;
    if (v.company_size !== undefined) patch.company_size = v.company_size;
    if (v.primary_use_case !== undefined) patch.primary_use_case = v.primary_use_case;
    if (v.referral_source !== undefined) patch.referral_source = v.referral_source;

    const touchedDemo = Object.keys(req.validated).some((k) => DEMOGRAPHIC_PATCH_KEYS.has(k));
    if (touchedDemo) patch.demographics_updated_at = new Date().toISOString();

    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", req.user.id)
      .select(meSelect)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

export default router;
