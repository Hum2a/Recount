import "../load-env.js";
import { z } from "zod";

/**
 * Production (or RELAXED_ENV=0): all vars required — fail fast.
 * Development / test: missing vars get safe placeholders so the process can boot
 * for UI work; API routes that hit external services will error until you configure .env.
 */
const strict =
  process.env.NODE_ENV === "production" || String(process.env.RELAXED_ENV) === "0";

const devDefaults = {
  SUPABASE_URL: "https://placeholder.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "dev-placeholder-supabase-service-role-not-real",
  SUPABASE_ANON_KEY: "dev-placeholder-supabase-anon-not-real",
  OPENAI_API_KEY: "sk-dev-placeholder-openai-not-real",
  STRIPE_SECRET_KEY: "sk_test_dev_placeholder_not_real",
  STRIPE_WEBHOOK_SECRET: "whsec_dev_placeholder_not_real",
  STRIPE_PRICE_ID: "price_dev_placeholder",
  RESEND_API_KEY: "re_dev_placeholder_not_real",
  FROM_EMAIL: "noreply@example.com",
  // Both hosts: browser Origin must match exactly; dev users often open Next on 127.0.0.1 vs localhost.
  ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
  WEB_URL: "http://localhost:3000",
};

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ALLOWED_ORIGINS: z.string().min(1),
  WEB_URL: z.string().url(),
  /**
   * Unused by this codebase: API auth uses Supabase-issued JWTs only.
   * Kept as an optional key so older `.env` files stay valid; omit unless you add custom JWT signing.
   */
  JWT_SECRET: z.string().min(32).optional(),
  /** Set to run POST /api/jobs/weekly-digest (cron / scheduler). */
  DIGEST_JOB_SECRET: z.preprocess((val) => {
    if (val === undefined || val === null || String(val).trim() === "") return undefined;
    return val;
  }, z.string().min(16).optional()),
  /** Optional. When set, `login_events.ip_hash` stores SHA-256(salt|client_ip) instead of leaving IP empty. */
  LOGIN_AUDIT_SALT: z.preprocess((val) => {
    if (val === undefined || val === null || String(val).trim() === "") return undefined;
    return val;
  }, z.string().min(16).optional()),
  /**
   * When "1" or "true", trust `X-Forwarded-For` (first hop) for client IP — use behind a reverse proxy.
   * Improves rate limiting and login audit IP hashing.
   */
  TRUST_PROXY: z.preprocess((val) => {
    if (val === undefined || val === null || String(val).trim() === "") return undefined;
    return String(val).trim().toLowerCase();
  }, z.enum(["0", "1", "false", "true"]).optional()),
  /**
   * When TRUST_PROXY is enabled: number of reverse-proxy hops for `X-Forwarded-For` (Express `trust proxy`).
   * Default 1 when omitted (single load balancer). Use 2+ only if your chain strips headers correctly.
   */
  TRUST_PROXY_HOPS: z.preprocess((val) => {
    if (val === undefined || val === null || String(val).trim() === "") return undefined;
    return val;
  }, z.coerce.number().int().min(1).max(10).optional()),
});

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === "";
}

/** @type {string[]} */
let placeholdersUsed = [];

function buildProcessEnvForParse() {
  const out = { ...process.env };
  if (strict) return out;

  placeholdersUsed = [];
  for (const [key, fallback] of Object.entries(devDefaults)) {
    if (isEmpty(out[key])) {
      out[key] = fallback;
      placeholdersUsed.push(key);
    }
  }
  return out;
}

const parsed = schema.safeParse(buildProcessEnvForParse());

if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  if (strict) {
    console.error("Tip: for local UI-only work, use NODE_ENV=development (default) and omit RELAXED_ENV=0.");
  }
  process.exit(1);
}

if (!strict && placeholdersUsed.length > 0) {
  console.warn(
    "[recount-api] Dev placeholders in use (set real values in packages/api/.env when ready):",
    placeholdersUsed.join(", ")
  );
  console.warn(
    "[recount-api] Auth, Stripe, OpenAI, and email will not work until those are configured."
  );
}

export const env = parsed.data;

/** True when non-strict mode filled any key from devDefaults */
export const usingDevPlaceholders = !strict && placeholdersUsed.length > 0;
