import Stripe from "stripe";
import { env } from "../config/env.js";
import { supabaseAdmin } from "../db/client.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

/** One-time Lifetime checkout — matches pricing page (£14.99). */
const LIFETIME_CHECKOUT_LINE_ITEM = {
  quantity: 1,
  price_data: {
    currency: "gbp",
    unit_amount: 1499,
    product_data: { name: "Recount Lifetime" },
  },
};

/**
 * @param {string} userId
 * @param {string} email
 */
export async function createCheckoutSession(userId, email) {
  const { data: profile, error: selErr } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (selErr) throw new Error(selErr.message);

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId },
    });
    customerId = customer.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [LIFETIME_CHECKOUT_LINE_ITEM],
    success_url: `${env.WEB_URL}/dashboard?payment=success`,
    cancel_url: `${env.WEB_URL}/pricing?payment=cancelled`,
    metadata: { userId },
  });

  return session.url;
}

export { stripe };
