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

function parseListQuery(query) {
  const rawQ = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const q = rawQ.replace(/[%_\\]/g, "");
  const limitRaw = Number.parseInt(String(query.limit ?? "50"), 10);
  const offsetRaw = Number.parseInt(String(query.offset ?? "0"), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  return { q, limit, offset };
}

/**
 * Paginated profile list for staff. **Admin or developer** (read-only use for developers on the web UI).
 */
router.get("/users", requireAuth, requireAppRole("admin", "developer"), async (req, res, next) => {
  try {
    const { q, limit, offset } = parseListQuery(req.query);

    let qb = supabaseAdmin
      .from("profiles")
      .select("id, email, app_role, license_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) qb = qb.ilike("email", `%${q}%`);

    const { data, error, count } = await qb;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      data: {
        users: data ?? [],
        total: count ?? 0,
        limit,
        offset,
      },
    });
  } catch (e) {
    next(e);
  }
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
