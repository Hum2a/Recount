import rateLimit from "express-rate-limit";

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

function authRateLimitKey(req) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const subpath = req.path || "";
  if (subpath.endsWith("/refresh")) {
    return `${ip}:refresh`;
  }
  const raw = req.body?.email;
  const email =
    typeof raw === "string"
      ? raw
          .toLowerCase()
          .trim()
          .slice(0, 320)
      : "";
  return `${ip}:${email || "no-email"}`;
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => authRateLimitKey(req),
});
