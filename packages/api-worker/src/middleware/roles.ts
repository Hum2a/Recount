import type { MiddlewareHandler } from "hono";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";

export function requireAppRole(...allowed: string[]): MiddlewareHandler<{ Bindings: WorkerEnv; Variables: AppVars }> {
  return async (c, next) => {
    const role = c.get("profile")?.app_role;
    if (role && allowed.includes(role)) {
      await next();
      return;
    }
    return c.json({ error: "Insufficient permissions" }, 403);
  };
}

export const requireElevatedStaff = requireAppRole("admin", "developer");
