import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";

function weekStartUtcString() {
  const d = new Date();
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(today).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

const team = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

team.get("/leaderboard", requireAuth, async (c) => {
  const userId = c.get("user").id;
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data: me, error: meErr } = await supabaseAdmin
    .from("profiles")
    .select("team_slug, leaderboard_opt_in, leaderboard_nickname")
    .eq("id", userId)
    .single();
  if (meErr) return c.json({ error: meErr.message }, 400);

  const slug = String(me?.team_slug ?? "")
    .trim()
    .toLowerCase();
  if (!slug) {
    return c.json({
      data: { team_slug: null, members: [], message: "Set a team slug in Settings to see a leaderboard." },
    });
  }

  const { data: members, error } = await supabaseAdmin
    .from("profiles")
    .select("id, leaderboard_nickname")
    .eq("team_slug", slug)
    .eq("leaderboard_opt_in", true);
  if (error) return c.json({ error: error.message }, 400);

  const ids = (members ?? []).map((m) => m.id).filter(Boolean);
  if (ids.length === 0) {
    return c.json({
      data: { team_slug: slug, members: [], message: "No teammates have opted into the leaderboard yet." },
    });
  }

  const weekStart = weekStartUtcString();
  const { data: evs, error: evErr } = await supabaseAdmin
    .from("tab_events")
    .select("user_id, duration_sec")
    .in("user_id", ids)
    .gte("date", weekStart);
  if (evErr) return c.json({ error: evErr.message }, 400);

  const secByUser: Record<string, number> = {};
  for (const row of evs ?? []) {
    const uid = String(row.user_id);
    secByUser[uid] = (secByUser[uid] ?? 0) + Number(row.duration_sec ?? 0);
  }
  const nickById = Object.fromEntries((members ?? []).map((m) => [m.id, m.leaderboard_nickname?.trim() || "Anonymous"]));
  const ranked = ids
    .map((id) => ({ nickname: nickById[id] || "Anonymous", minutes_week: Math.round((secByUser[id] ?? 0) / 60) }))
    .sort((a, b) => b.minutes_week - a.minutes_week)
    .map((row, i) => ({ rank: i + 1, ...row }));

  return c.json({
    data: {
      team_slug: slug,
      week_start_utc: weekStart,
      you_opted_in: Boolean(me?.leaderboard_opt_in),
      members: ranked,
    },
  });
});

export default team;
