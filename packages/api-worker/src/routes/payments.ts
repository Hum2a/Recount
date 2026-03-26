import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { createSupabaseAdmin } from "../supabase";
import { createCheckoutSession, stripeClient } from "../services/stripe";
import { sendLicenseEmail } from "../services/resend";
import type { WorkerEnv } from "../env";
import type { AppVars } from "../types";

const payments = new Hono<{ Bindings: WorkerEnv; Variables: AppVars }>();

payments.post("/create-session", requireAuth, async (c) => {
  const email = c.get("user").email;
  if (!email) return c.json({ error: "Email required on account" }, 400);
  const url = await createCheckoutSession(c.env, c.get("user").id, email);
  if (!url) return c.json({ error: "Could not create checkout session" }, 500);
  return c.json({ data: { url } });
});

payments.get("/status", requireAuth, async (c) => {
  const { data, error } = await createSupabaseAdmin(c.env)
    .from("profiles")
    .select("license_active, license_key, app_role")
    .eq("id", c.get("user").id)
    .single();
  if (error) return c.json({ error: error.message }, 400);
  return c.json({
    data: {
      license_active: Boolean(data?.license_active),
      license_key: data?.license_key ?? null,
      app_role: data?.app_role ?? "user",
    },
  });
});

payments.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.text("Webhook Error: Missing stripe-signature", 400);

  let event;
  try {
    const stripe = stripeClient(c.env);
    const body = await c.req.text();
    event = stripe.webhooks.constructEvent(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return c.text(`Webhook Error: ${message}`, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (userId) {
      const supabaseAdmin = createSupabaseAdmin(c.env);
      const licenseKey = randomUUID();
      const paymentRef = session.payment_intent ? String(session.payment_intent) : String(session.id);

      await supabaseAdmin.from("profiles").update({ license_active: true, license_key: licenseKey }).eq("id", userId);
      await supabaseAdmin.from("payments").upsert(
        {
          user_id: userId,
          stripe_payment_id: paymentRef,
          amount_pence: session.amount_total ?? 0,
          currency: session.currency ?? "gbp",
          status: "succeeded",
        },
        { onConflict: "stripe_payment_id" }
      );

      const customerEmail = session.customer_details?.email ?? session.customer_email;
      if (customerEmail) await sendLicenseEmail(c.env, customerEmail, licenseKey);
    }
  }

  return c.json({ received: true });
});

export default payments;
