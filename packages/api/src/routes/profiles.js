import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const patchSchema = z
  .object({
    hourly_rate: z.coerce.number().min(0).max(99999999).optional(),
    timezone: z.string().min(1).max(100).optional(),
  })
  .refine((d) => d.hourly_rate !== undefined || d.timezone !== undefined, {
    message: "Provide hourly_rate and/or timezone",
  });

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email, hourly_rate, timezone, license_active")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

router.patch("/", requireAuth, validate(patchSchema), async (req, res, next) => {
  try {
    const patch = {};
    if (req.validated.hourly_rate !== undefined) patch.hourly_rate = req.validated.hourly_rate;
    if (req.validated.timezone !== undefined) patch.timezone = req.validated.timezone;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("id", req.user.id)
      .select("hourly_rate, timezone, updated_at")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

export default router;
