import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth, requireLicense } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { mapReportOpenAIError } from "../lib/report-openai-errors.js";
import {
  countReportGenerationsThisUtcDay,
  insertReportGenerateEvent,
  maxReportGenerationsPerUtcDay,
} from "../lib/report-rate-limit.js";
import { generateAccountabilityReport } from "../services/openai.js";

const router = Router();

const generateSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

const dateParamsSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

async function aggregateDay(userId, date) {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;

  const { data, error } = await supabaseAdmin
    .from("tab_events")
    .select("domain, duration_sec, category")
    .eq("user_id", userId)
    .gte("start_time", start)
    .lte("start_time", end);

  if (error) throw new Error(error.message);

  /** @type {Record<string, { seconds: number, category: string }>} */
  const byDomain = {};
  for (const row of data ?? []) {
    const sec = row.duration_sec ?? 0;
    if (!byDomain[row.domain]) {
      byDomain[row.domain] = { seconds: 0, category: row.category ?? "other" };
    }
    byDomain[row.domain].seconds += sec;
  }

  const domainSummary = Object.entries(byDomain)
    .map(([domain, v]) => ({ domain, seconds: v.seconds, category: v.category }))
    .sort((a, b) => b.seconds - a.seconds);

  const totalActiveSec = domainSummary.reduce((s, d) => s + d.seconds, 0);
  return { domainSummary, totalActiveSec };
}

router.post("/generate", requireAuth, requireLicense, validate(generateSchema), async (req, res, next) => {
  try {
    const { date } = req.validated;

    const { data: intention } = await supabaseAdmin
      .from("intentions")
      .select("goals")
      .eq("user_id", req.user.id)
      .eq("date", date)
      .maybeSingle();

    const intentions = { goals: intention?.goals ?? [] };
    const { domainSummary, totalActiveSec } = await aggregateDay(req.user.id, date);
    const totalActiveMin = Math.round(totalActiveSec / 60);

    const { count: genCount, error: genCountErr } = await countReportGenerationsThisUtcDay(
      supabaseAdmin,
      req.user.id
    );
    if (genCountErr) throw genCountErr;
    const dailyMax = maxReportGenerationsPerUtcDay();
    if ((genCount ?? 0) >= dailyMax) {
      return res.status(429).json({
        error: `Daily report generation limit reached (${dailyMax} per UTC day). Try again tomorrow.`,
        code: "report_daily_limit",
      });
    }

    await insertReportGenerateEvent(supabaseAdmin, req.user.id, date);

    let ai_summary;
    let score;
    let goals_met;
    let goals_missed;
    try {
      ({ ai_summary, score, goals_met, goals_missed } = await generateAccountabilityReport(
        intentions,
        domainSummary,
        totalActiveMin,
        date
      ));
    } catch (openaiErr) {
      const { httpStatus, body } = mapReportOpenAIError(openaiErr);
      return res.status(httpStatus).json(body);
    }

    const top_domains = domainSummary.slice(0, 15).map((d) => ({
      domain: d.domain,
      seconds: d.seconds,
      category: d.category,
    }));

    const { data: saved, error } = await supabaseAdmin
      .from("reports")
      .upsert(
        {
          user_id: req.user.id,
          date,
          ai_summary,
          score,
          top_domains,
          goals_met,
          goals_missed,
        },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: saved });
  } catch (e) {
    next(e);
  }
});

router.get("/history", requireAuth, requireLicense, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id, date, score, generated_at, ai_summary")
      .eq("user_id", req.user.id)
      .order("date", { ascending: false })
      .limit(30);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: data ?? [] });
  } catch (e) {
    next(e);
  }
});

router.get("/:date", requireAuth, requireLicense, validate(dateParamsSchema, "params"), async (req, res, next) => {
  try {
    const { date } = req.validated;
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("*")
      .eq("user_id", req.user.id)
      .eq("date", date)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data: data ?? null });
  } catch (e) {
    next(e);
  }
});

export default router;
