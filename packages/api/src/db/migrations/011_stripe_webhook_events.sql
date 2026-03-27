-- Idempotent Stripe webhook handling: one row per delivered Stripe event id (evt_...).
-- Apply after verifying the signature; skip business logic if this id already exists.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received_at ON public.stripe_webhook_events (received_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.stripe_webhook_events FROM PUBLIC;
GRANT ALL PRIVILEGES ON TABLE public.stripe_webhook_events TO service_role;
