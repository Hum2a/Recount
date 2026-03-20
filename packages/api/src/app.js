import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import { env } from "./config/env.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import intentionsRoutes from "./routes/intentions.js";
import reportsRoutes from "./routes/reports.js";
import paymentsRoutes, { stripeWebhookHandler } from "./routes/payments.js";
import profilesRoutes from "./routes/profiles.js";
import adminRoutes from "./routes/admin.js";

const app = express();

const origins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(compression());

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "100kb" }));

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

app.use(errorHandler);

export default app;
