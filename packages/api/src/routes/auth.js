import { Router } from "express";
import { z } from "zod";
import { supabaseAuth } from "../db/client-auth.js";
import { supabaseAdmin } from "../db/client.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { logger } from "../logger.js";
import { recordLoginEvent } from "../lib/login-events.js";

const router = Router();

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

router.post("/signup", authLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) {
      const dup =
        /already|registered|exists/i.test(createErr.message ?? "") || createErr.code === "email_exists";
      if (dup) {
        logger.warn({ err: createErr }, "signup duplicate");
        return res.status(400).json({ error: "Could not complete signup. Try again or use a different email." });
      }
      logger.error({ err: createErr }, "signup createUser");
      return res.status(500).json({ error: "Could not complete signup" });
    }
    if (!created?.user) return res.status(400).json({ error: "Signup failed" });

    const { data: signInData, error: signInErr } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signInData?.session) {
      logger.warn({ err: signInErr }, "sign-in after signup");
      return res.status(500).json({
        error: "Account created but automatic sign-in failed. Try signing in with your email and password.",
      });
    }
    const session = signInData.session;
    const user = created.user;

    const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
      { id: user.id, email },
      { onConflict: "id" }
    );
    if (profileErr) {
      logger.error({ err: profileErr }, "profile upsert on signup");
      return res.status(500).json({ error: "Could not create profile" });
    }

    await recordLoginEvent(supabaseAdmin, {
      userId: user.id,
      eventType: "signup",
      provider: "password",
      req,
    });

    return res.json({
      data: {
        user,
        session,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated;
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!data.session) return res.status(401).json({ error: "Invalid credentials" });

    await supabaseAdmin.from("profiles").upsert(
      { id: data.user.id, email: data.user.email ?? email },
      { onConflict: "id" }
    );

    await recordLoginEvent(supabaseAdmin, {
      userId: data.user.id,
      eventType: "login",
      provider: "password",
      req,
    });

    return res.json({
      data: {
        user: data.user,
        session: data.session,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/refresh", authLimiter, validate(refreshSchema), async (req, res, next) => {
  try {
    const { refresh_token } = req.validated;
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    return res.json({
      data: {
        session: data.session,
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
