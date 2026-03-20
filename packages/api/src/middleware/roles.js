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
