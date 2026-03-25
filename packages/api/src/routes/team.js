import { Router } from "express";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * Weekly minutes (UTC Mon–Sun of current week) for leaderboard.
 */
function weekStartUtcString() {
  const d = new Date();
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(today).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

router.get("/leaderboard", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: me, error: meErr } = await supabaseAdmin
      .from("profiles")
      .select("team_slug, leaderboard_opt_in, leaderboard_nickname")
      .eq("id", userId)
      .single();

    if (meErr) return res.status(400).json({ error: meErr.message });
    const slug = me?.team_slug?.trim()?.toLowerCase() || null;
    if (!slug) {
      return res.json({
        data: { team_slug: null, members: [], message: "Set a team slug in Settings to see a leaderboard." },
      });
    }

    const { data: members, error } = await supabaseAdmin
      .from("profiles")
      .select("id, leaderboard_nickname")
      .eq("team_slug", slug)
      .eq("leaderboard_opt_in", true);

    if (error) return res.status(400).json({ error: error.message });

    const ids = (members ?? []).map((m) => m.id).filter(Boolean);
    if (ids.length === 0) {
      return res.json({
        data: {
          team_slug: slug,
          members: [],
          message: "No teammates have opted into the leaderboard yet.",
        },
      });
    }

    const weekStart = weekStartUtcString();
    const { data: evs, error: evErr } = await supabaseAdmin
      .from("tab_events")
      .select("user_id, duration_sec")
      .in("user_id", ids)
      .gte("date", weekStart);

    if (evErr) return res.status(400).json({ error: evErr.message });

    /** @type {Record<string, number>} */
    const secByUser = {};
    for (const row of evs ?? []) {
      const uid = row.user_id;
      secByUser[uid] = (secByUser[uid] ?? 0) + (row.duration_sec ?? 0);
    }

    const nickById = Object.fromEntries((members ?? []).map((m) => [m.id, m.leaderboard_nickname?.trim() || "Anonymous"]));

    const ranked = ids
      .map((id) => ({
        nickname: nickById[id] || "Anonymous",
        minutes_week: Math.round((secByUser[id] ?? 0) / 60),
      }))
      .sort((a, b) => b.minutes_week - a.minutes_week)
      .map((row, i) => ({ rank: i + 1, ...row }));

    return res.json({
      data: {
        team_slug: slug,
        week_start_utc: weekStart,
        you_opted_in: Boolean(me?.leaderboard_opt_in),
        members: ranked,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
