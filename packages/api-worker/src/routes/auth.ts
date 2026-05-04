import { Hono } from "hono";
import { z } from "zod";
import { createSupabaseAdmin, createSupabaseAuth } from "../supabase";
import { recordLoginEvent } from "../lib/login-events";
import { zodErrorMessage } from "../utils";
import type { WorkerEnv } from "../env";

const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

const signupSchema = z
  .object({
    email: z.string().email(),
    password: strongPasswordSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

const refreshSchema = z
  .object({
    refresh_token: z.string().min(1),
  })
  .strict();

const auth = new Hono<{ Bindings: WorkerEnv }>();

auth.post("/signup", async (c) => {
  const parsed = signupSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const { email, password } = parsed.data;
  const supabaseAuth = createSupabaseAuth(c.env);
  const supabaseAdmin = createSupabaseAdmin(c.env);

  /** Server-side create avoids fragile signUp(null session) + admin.updateUserById(email_confirm). */
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const dup =
      /already|registered|exists/i.test(createErr.message ?? "") ||
      (createErr as { code?: string }).code === "email_exists";
    if (dup) {
      return c.json({ error: "Could not complete signup. Try again or use a different email." }, 400);
    }
    console.error("[auth/signup] admin.createUser", createErr);
    return c.json({ error: "Could not complete signup" }, 500);
  }
  if (!created?.user) return c.json({ error: "Signup failed" }, 400);

  const { data: signInData, error: signInErr } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (signInErr || !signInData?.session) {
    console.error("[auth/signup] signIn after create", signInErr);
    return c.json(
      {
        error: "Account created but automatic sign-in failed. Try signing in with your email and password.",
      },
      500
    );
  }
  const session = signInData.session;
  const user = created.user;

  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({ id: user.id, email }, { onConflict: "id" });
  if (profileErr) return c.json({ error: "Could not create profile" }, 500);

  await recordLoginEvent({
    env: c.env,
    userId: user.id,
    eventType: "signup",
    provider: "password",
    userAgent: c.req.header("User-Agent") ?? null,
    forwardedFor: c.req.header("x-forwarded-for") ?? null,
  });

  return c.json({
    data: {
      user,
      session,
    },
  });
});

auth.post("/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const { email, password } = parsed.data;
  const supabaseAuth = createSupabaseAuth(c.env);
  const supabaseAdmin = createSupabaseAdmin(c.env);
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
  if (error) return c.json({ error: "Invalid credentials" }, 401);
  if (!data.session) return c.json({ error: "Invalid credentials" }, 401);

  await supabaseAdmin.from("profiles").upsert({ id: data.user.id, email: data.user.email ?? email }, { onConflict: "id" });

  await recordLoginEvent({
    env: c.env,
    userId: data.user.id,
    eventType: "login",
    provider: "password",
    userAgent: c.req.header("User-Agent") ?? null,
    forwardedFor: c.req.header("x-forwarded-for") ?? null,
  });

  return c.json({
    data: {
      user: data.user,
      session: data.session,
    },
  });
});

auth.post("/refresh", async (c) => {
  const parsed = refreshSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: zodErrorMessage(parsed.error) }, 400);

  const supabaseAuth = createSupabaseAuth(c.env);
  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: parsed.data.refresh_token });
  if (error || !data.session) return c.json({ error: "Invalid or expired session" }, 401);

  return c.json({
    data: {
      session: data.session,
    },
  });
});

export default auth;
