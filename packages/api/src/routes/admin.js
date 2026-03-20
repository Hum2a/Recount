import { Router } from "express";
import { z } from "zod";
import { APP_ROLES } from "@recount/shared";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAppRole } from "../middleware/roles.js";

const router = Router();

const patchRoleBody = z.object({
  app_role: z.enum([...APP_ROLES]),
});

/**
 * Change another user’s `app_role`. **Admin only.** Billing is unchanged (`license_active`).
 */
router.patch("/users/:userId/role", requireAuth, requireAppRole("admin"), async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!z.string().uuid().safeParse(userId).success) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const parsed = patchRoleBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ app_role: parsed.data.app_role, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id, email, app_role")
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    next(e);
  }
});

export default router;
