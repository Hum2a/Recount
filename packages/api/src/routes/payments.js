import { randomUUID } from "crypto";
import { Router } from "express";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { createCheckoutSession, stripe } from "../services/stripe.js";
import { sendLicenseEmail } from "../services/resend.js";
import { logger } from "../logger.js";

const router = Router();

router.post("/create-session", requireAuth, async (req, res, next) => {
  try {
    const email = req.user.email;
    if (!email) return res.status(400).json({ error: "Email required on account" });
    const url = await createCheckoutSession(req.user.id, email);
    if (!url) return res.status(500).json({ error: "Could not create checkout session" });
    return res.json({ data: { url } });
  } catch (e) {
    next(e);
  }
});

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("license_active, license_key")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      data: {
        license_active: data?.license_active ?? false,
        license_key: data?.license_key ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Raw body handler mounted in app.js before express.json
 */
export async function stripeWebhookHandler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "stripe webhook signature");
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    if (!userId) {
      logger.warn("checkout.session.completed missing userId metadata");
    } else {
      const licenseKey = randomUUID();
      const paymentRef = session.payment_intent
        ? String(session.payment_intent)
        : String(session.id);

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ license_active: true, license_key: licenseKey })
        .eq("id", userId);

      if (profileErr) logger.error({ err: profileErr }, "profile license update");

      const { error: payErr } = await supabaseAdmin.from("payments").upsert(
        {
          user_id: userId,
          stripe_payment_id: paymentRef,
          amount_pence: session.amount_total ?? 0,
          currency: session.currency ?? "gbp",
          status: "succeeded",
        },
        { onConflict: "stripe_payment_id" }
      );

      if (payErr) logger.error({ err: payErr }, "payments upsert");

      const customerEmail = session.customer_details?.email ?? session.customer_email;
      if (customerEmail) {
        await sendLicenseEmail(customerEmail, licenseKey);
      }
    }
  }

  return res.json({ received: true });
}

export default router;
