# Stripe QA Checklist

Use this against local stack (`web :3000`, `api :3001`) in Stripe **test** mode, or repeat in **live** mode before announcing pricing.

**Pricing:** Lifetime is **£9.99** one-time; Checkout uses env **`STRIPE_PRICE_ID`** (configure the amount and currency on that Price in Stripe).

---

## Repo / CI (aligned with current code)

- [x] Checkout uses **`STRIPE_PRICE_ID`** (test Price id with `sk_test_…`, live Price id with `sk_live_…`)
- [x] Marketing copy shows **£9.99** (`/pricing`, upgrade card, home)
- [x] Webhook tests cover `checkout.session.completed` (`npm run test:api`)
- [x] Cloudflare secret sync includes **`STRIPE_PRICE_ID`** (`npm run sync:cf:env`)

---

## Manual QA — preflight

- [ ] API env: `STRIPE_SECRET_KEY`, **`STRIPE_PRICE_ID`**, `STRIPE_WEBHOOK_SECRET`, `WEB_URL=http://localhost:3000`, valid Supabase keys
- [ ] Web env: `NEXT_PUBLIC_API_URL=http://localhost:3001`
- [ ] Run `npm run dev:api` and `npm run dev:web`
- [ ] Run Stripe forwarder:
  - `stripe listen --events checkout.session.completed --forward-to http://localhost:3001/api/payments/webhook`
- [ ] Restart API after updating `STRIPE_WEBHOOK_SECRET`

## A) Create Checkout Session

- [ ] Signed-in user on `/pricing` clicks **Unlock lifetime access**
- [ ] Redirects to Stripe Checkout URL
- [ ] Checkout line shows **£9.99** (from your Stripe Price)
- [ ] No API error returned from `POST /api/payments/create-session`

## B) Cancel Flow

- [ ] On Checkout, cancel payment
- [ ] Redirect to `/pricing?payment=cancelled`
- [ ] UI shows "Checkout was cancelled - you have not been charged."

## C) Successful Payment

- [ ] Card: `4242 4242 4242 4242` (future expiry, any CVC/ZIP)
- [ ] Redirect to `/dashboard?payment=success`
- [ ] `GET /api/payments/status` indicates `license_active=true`
- [ ] Paid features unlock in dashboard (no upgrade gating)

## D) 3DS Flow

- [ ] Card: `4000 0025 0000 3155`
- [ ] Complete challenge successfully
- [ ] Same post-success checks as section C

## E) Decline Flow

- [ ] Card: `4000 0000 0000 0002`
- [ ] Stripe shows decline (no success redirect)
- [ ] No license activation in app

## F) Webhook Signature Guard

- [ ] Send webhook with bad/missing signature (or simulate)
- [ ] API responds `400` and does not mutate payment/license state

## G) Webhook Idempotency (Critical)

- [ ] Re-deliver the same `checkout.session.completed` event from Stripe
- [ ] App returns success but does not duplicate side effects
- [ ] `payments` remains one effective payment record per `stripe_payment_id`
- [ ] No duplicate first-time license email
- [ ] `stripe_webhook_events` dedupe remains intact

---

# SQL Snippet Pack (Supabase SQL Editor)

Replace placeholders first:

- `<USER_UUID>` user being tested
- `<EVENT_ID>` Stripe event id (for example `evt_...`)
- `<PAYMENT_REF>` `payment_intent` id (for example `pi_...`) or fallback `cs_...`

After a **£9.99** purchase, `amount_pence` should be **999** (Stripe Checkout total in minor units).

```sql
-- 1) Current license/payment status for user
select
  p.id,
  p.email,
  p.license_active,
  p.license_key,
  p.app_role,
  p.stripe_customer_id
from profiles p
where p.id = '<USER_UUID>';
```

```sql
-- 2) Latest payments for user
select
  user_id,
  stripe_payment_id,
  amount_pence,
  currency,
  status,
  created_at
from payments
where user_id = '<USER_UUID>'
order by created_at desc
limit 20;
```

```sql
-- 3) Confirm specific payment reference exists once
select
  stripe_payment_id,
  count(*) as cnt
from payments
where stripe_payment_id = '<PAYMENT_REF>'
group by stripe_payment_id;
```

```sql
-- 4) Webhook event ledger (dedupe table)
select
  id,
  event_type,
  received_at
from stripe_webhook_events
where id = '<EVENT_ID>';
```

```sql
-- 5) Recent webhook events
select
  id,
  event_type,
  received_at
from stripe_webhook_events
order by received_at desc
limit 20;
```

```sql
-- 6) Quick combined audit for one user
select
  p.id as user_id,
  p.email,
  p.license_active,
  p.license_key,
  pay.stripe_payment_id,
  pay.amount_pence,
  pay.currency,
  pay.status as payment_status,
  pay.created_at as payment_created_at
from profiles p
left join lateral (
  select stripe_payment_id, amount_pence, currency, status, created_at
  from payments
  where payments.user_id = p.id
  order by created_at desc
  limit 1
) pay on true
where p.id = '<USER_UUID>';
```

---

# Optional Stripe CLI Helpers

- Trigger sample event quickly (not tied to real Checkout session metadata):
  - `stripe trigger checkout.session.completed`
- Re-send a real event from Stripe Dashboard Webhooks (best for idempotency test)
