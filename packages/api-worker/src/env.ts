import { z } from "zod";

export const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  /** Stripe Dashboard Price for Lifetime one-time checkout (e.g. £9.99 GBP). */
  STRIPE_PRICE_ID: z.string().regex(/^price_[A-Za-z0-9]+$/, "Must be a Stripe Price id (price_…)"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
  WEB_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().min(1),
  DIGEST_JOB_SECRET: z.string().optional(),
  LOGIN_AUDIT_SALT: z.string().min(16).optional(),
});

export type WorkerEnv = z.infer<typeof envSchema>;
