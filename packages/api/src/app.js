import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import intentionsRoutes from "./routes/intentions.js";
import reportsRoutes from "./routes/reports.js";
import paymentsRoutes, { stripeWebhookHandler } from "./routes/payments.js";
import profilesRoutes from "./routes/profiles.js";
import adminRoutes from "./routes/admin.js";
import teamRoutes from "./routes/team.js";
import jobsRoutes from "./routes/jobs.js";

const app = express();

if (env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true") {
  const hops = env.TRUST_PROXY_HOPS ?? 1;
  app.set("trust proxy", hops);
}

const origins = new Set(
  env.ALLOWED_ORIGINS.split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

/** Typical Next dev origins so local .env mistakes don’t break CORS preflight. */
if (env.NODE_ENV === "development") {
  for (const o of ["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
    origins.add(o);
  }
  try {
    origins.add(new URL(env.WEB_URL).origin);
  } catch {
    /* ignore invalid WEB_URL */
  }
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return origins.has(origin);
}

app.disable("x-powered-by");

if (env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      logger.info(
        {
          method: req.method,
          path: req.originalUrl ?? req.url,
          status: res.statusCode,
          ms: Date.now() - start,
          origin: req.headers.origin ?? null,
        },
        "http"
      );
    });
    next();
  });
}

app.use(
  helmet({
    // API is consumed by browser clients and extension; CSP belongs to web app/static assets.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(compression());

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", rateLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/intentions", intentionsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/profiles", profilesRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/jobs", jobsRoutes);

app.use(errorHandler);

export default app;
