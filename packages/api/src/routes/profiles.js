import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { computeStreaksForUser } from "../lib/streaks.js";

const router = Router();

const patchSchema = z
  .object({
    hourly_rate: z.coerce.number().min(0).max(99999999).optional(),
    timezone: z.string().min(1).max(100).optional(),
    distraction_domains: z.array(z.string().min(1).max(253)).max(100).optional(),
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
  })
  .refine((d) => Object.keys(d).length > 0, { message: "Provide at least one field" });

function normalizeHostname(line) {
  return String(line)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

const meSelect =
  "email, hourly_rate, timezone, license_active, app_role, distraction_domains, intent_lock_enabled, weekly_digest_enabled, send_tab_titles, team_slug, leaderboard_opt_in, leaderboard_nickname";

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
