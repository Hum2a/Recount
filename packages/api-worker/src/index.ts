import { Hono } from "hono";
import { envSchema, type WorkerEnv } from "./env";
import authRoutes from "./routes/auth";
import profilesRoutes from "./routes/profiles";
import intentionsRoutes from "./routes/intentions";
import eventsRoutes from "./routes/events";
import reportsRoutes from "./routes/reports";
import paymentsRoutes from "./routes/payments";
import teamRoutes from "./routes/team";
import jobsRoutes from "./routes/jobs";
import adminRoutes from "./routes/admin";
import type { AppVars } from "./types";

const app = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

/** Canonical origin for comparison (lowercases host, drops path/query). Accepts host-only secrets via https:// fallback. */
function canonicalOrigin(raw: string): string | null {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    try {
      return new URL(`https://${t}`).origin;
    } catch {
      return null;
    }
  }
}

/** Allowed browser origins: comma-separated ALLOWED_ORIGINS plus WEB_URL (dashboard URL). */
function allowedOriginSet(env: WorkerEnv) {
  const out = new Set<string>();
  for (const part of (env.ALLOWED_ORIGINS ?? "").split(",")) {
    const c = canonicalOrigin(part);
    if (c) out.add(c);
  }
  const web = env.WEB_URL ? canonicalOrigin(env.WEB_URL) : null;
  if (web) out.add(web);
  return out;
}

const CORS_ALLOW_HEADERS =
  "Authorization, Content-Type, X-Recount-Job-Secret, Stripe-Signature";
const CORS_ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";

/**
 * Explicit CORS (no @hono/cors): runs before env validation, uses URL.origin equality so
 * trailing slashes / host casing cannot break matches. Preflight must return ACAO or the
 * browser reports a generic CORS failure.
 */
app.use("*", async (c, next) => {
  const originHeader = c.req.header("Origin") ?? "";
  const allow = allowedOriginSet(c.env);
  const requestOrigin = canonicalOrigin(originHeader);
  const allowed = Boolean(requestOrigin && allow.has(requestOrigin));

  if (c.req.method === "OPTIONS") {
    if (!allowed || !originHeader) {
      return new Response(null, { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": originHeader,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": CORS_ALLOW_METHODS,
        "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    });
  }

  if (allowed && originHeader) {
    c.header("Access-Control-Allow-Origin", originHeader);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin", { append: true });
  }

  await next();
});

app.use("*", async (c, next) => {
  if (c.req.path === "/health") {
    await next();
    return;
  }
  const parsed = envSchema.safeParse(c.env);
  if (!parsed.success) {
    return c.json(
      {
        error: "Worker environment invalid.",
        details: parsed.error.flatten().fieldErrors,
      },
      500
    );
  }
  await next();
});

app.get("/health", (c) =>
  c.json({
    status: "ok",
    runtime: "cloudflare-worker",
    corsAllowlistSize: allowedOriginSet(c.env).size,
  })
);
app.route("/api/auth", authRoutes);
app.route("/api/events", eventsRoutes);
app.route("/api/intentions", intentionsRoutes);
app.route("/api/payments", paymentsRoutes);
app.route("/api/profiles", profilesRoutes);
app.route("/api/reports", reportsRoutes);
app.route("/api/team", teamRoutes);
app.route("/api/jobs", jobsRoutes);
app.route("/api/admin", adminRoutes);

const pending = [] as const;

for (const route of pending) {
  app.all(route, (c) => {
    return c.json(
      {
        error: "Not migrated yet.",
        route,
        hint: "Migrate this Express route from packages/api/src/routes to packages/api-worker/src.",
      },
      501
    );
  });
}

export default app;
