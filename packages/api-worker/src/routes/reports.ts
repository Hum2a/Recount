import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireLicense } from "../middleware/auth";
import { createSupabaseAdmin } from "../supabase";
import { generateAccountabilityReport } from "../services/openai";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";
import { zodErrorMessage } from "../utils";

const generateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function aggregateDay(env: WorkerEnv, userId: string, date: string) {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const supabaseAdmin = createSupabaseAdmin(env);
  const { data, error } = await supabaseAdmin
    .from("tab_events")
    .select("domain, duration_sec, category")
    .eq("user_id", userId)
    .gte("start_time", start)
    .lte("start_time", end);
  if (error) throw new Error(error.message);

  const byDomain: Record<string, { seconds: number; category: string }> = {};
  for (const row of data ?? []) {
    const domain = String(row.domain ?? "");
    const sec = Number(row.duration_sec ?? 0);
    if (!byDomain[domain]) byDomain[domain] = { seconds: 0, category: String(row.category ?? "other") };
    byDomain[domain].seconds += sec;
  }
  const domainSummary = Object.entries(byDomain)
    .map(([domain, v]) => ({ domain, seconds: v.seconds, category: v.category }))
    .sort((a, b) => b.seconds - a.seconds);
  const totalActiveSec = domainSummary.reduce((s, d) => s + d.seconds, 0);
  return { domainSummary, totalActiveSec };
}

const reports = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

reports.post("/generate", requireAuth, requireLicense, async (c) => {
  const parsed = generateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const { date } = parsed.data;
  const userId = c.get("user").id;
  const supabaseAdmin = createSupabaseAdmin(c.env);

  const { data: intention } = await supabaseAdmin
    .from("intentions")
    .select("goals")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  const intentions = { goals: ((intention?.goals as unknown[]) ?? []).map((g) => String(g)) };
  const { domainSummary, totalActiveSec } = await aggregateDay(c.env, userId, date);
  const totalActiveMin = Math.round(totalActiveSec / 60);
  const { ai_summary, score, goals_met, goals_missed } = await generateAccountabilityReport(
    c.env,
    intentions,
    domainSummary,
    totalActiveMin,
    date
  );

  const top_domains = domainSummary.slice(0, 15).map((d) => ({
    domain: d.domain,
    seconds: d.seconds,
    category: d.category,
  }));

  const { data: saved, error } = await supabaseAdmin
    .from("reports")
    .upsert(
      { user_id: userId, date, ai_summary, score, top_domains, goals_met, goals_missed },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: saved });
});

reports.get("/history", requireAuth, requireLicense, async (c) => {
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("reports")
    .select("id, date, score, generated_at, ai_summary")
    .eq("user_id", c.get("user").id)
    .order("date", { ascending: false })
    .limit(30);
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: data ?? [] });
});

reports.get("/:date", requireAuth, requireLicense, async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "Invalid date" }, 400);
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("reports")
    .select("*")
    .eq("user_id", c.get("user").id)
    .eq("date", date)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: data ?? null });
});

export default reports;
