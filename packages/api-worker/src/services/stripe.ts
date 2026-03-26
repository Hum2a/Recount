import Stripe from "stripe";
import type { WorkerEnv } from "../env";
import { createSupabaseAdmin } from "../supabase";

export function stripeClient(env: WorkerEnv) {
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function createCheckoutSession(env: WorkerEnv, userId: string, email: string) {
  const supabaseAdmin = createSupabaseAdmin(env);
  const stripe = stripeClient(env);

  const { data: profile, error: selErr } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (selErr) throw new Error(selErr.message);

  let customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    await supabaseAdmin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.WEB_URL}/dashboard?payment=success`,
    cancel_url: `${env.WEB_URL}/pricing?payment=cancelled`,
    metadata: { userId },
  });

  return session.url;
}
