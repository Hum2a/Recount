import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { createSupabaseAdmin } from "../supabase";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";
import { zodErrorMessage } from "../utils";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goals: z.array(z.string().min(1).max(500)).min(1).max(20),
});

const intentions = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

intentions.post("/", requireAuth, async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);
  const { date, goals } = parsed.data;
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin
    .from("intentions")
    .upsert({ user_id: c.get("user").id, date, goals }, { onConflict: "user_id,date" })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data });
});

intentions.get("/:date", requireAuth, async (c) => {
  const date = c.req.param("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "Invalid date" }, 400);
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAdmin
    .from("intentions")
    .select("*")
    .eq("user_id", c.get("user").id)
    .eq("date", date)
    .maybeSingle();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({ data: data ?? null });
});

export default intentions;
