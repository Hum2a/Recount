/**
 * Use after `requireAuth` (needs `req.profile.app_role`).
 * @param {...import("@recount/shared").AppRole} allowed
 */
export function requireAppRole(...allowed) {
  return (req, res, next) => {
    const role = req.profile?.app_role;
    if (role && allowed.includes(role)) {
      next();
      return;
    }
    res.status(403).json({ error: "Insufficient permissions" });
  };
}

/**
 * Admin API routes and destructive staff actions: both `admin` and `developer` have full access.
 * Use `requireAppRole(...)` for narrower checks elsewhere.
 */
export const requireElevatedStaff = requireAppRole("admin", "developer");
