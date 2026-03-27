import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const createSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    goals: z.array(z.string().min(1).max(500)).min(1).max(20),
  })
  .strict();

const dateParamsSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

router.post("/", requireAuth, validate(createSchema), async (req, res, next) => {
  try {
    const { date, goals } = req.validated;
    const { data, error } = await supabaseAdmin
      .from("intentions")
      .upsert(
        { user_id: req.user.id, date, goals },
        { onConflict: "user_id,date" }
      )
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

router.get("/:date", requireAuth, validate(dateParamsSchema, "params"), async (req, res, next) => {
  try {
    const { date } = req.validated;
    const { data, error } = await supabaseAdmin
      .from("intentions")
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
