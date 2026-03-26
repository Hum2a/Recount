import { Hono } from "hono";
import { cors } from "hono/cors";
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

/** Browser `Origin` has no trailing slash; secrets often accidentally include one. */
function normalizeOrigin(url: string) {
  const t = url.trim();
  return t.endsWith("/") ? t.slice(0, -1) : t;
}

const app = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

function allowedOriginSet(c: { env: WorkerEnv }) {
  const fromSecret = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter(Boolean);
  const web = c.env.WEB_URL ? normalizeOrigin(c.env.WEB_URL) : "";
  return new Set<string>([...fromSecret, ...(web ? [web] : [])]);
}

/** CORS must run before env validation: otherwise failed validation returns 500 with no ACAO and the browser reports a bogus "CORS" preflight error. */
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allow = allowedOriginSet(c);
      if (!origin) return "";
      const o = normalizeOrigin(origin);
      if (allow.has(o)) return origin;
      return "";
    },
    allowHeaders: ["Authorization", "Content-Type", "X-Recount-Job-Secret", "Stripe-Signature"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Content-Type"],
    maxAge: 86400,
    credentials: true,
  })
);

app.use("*", async (c, next) => {
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

app.get("/health", (c) => c.json({ status: "ok", runtime: "cloudflare-worker" }));
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
