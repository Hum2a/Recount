-- Soft rate limit ledger for POST /api/reports/generate (UTC calendar day).
-- Accessed only via service role from the API.

CREATE TABLE public.report_generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_gen_events_user_created ON public.report_generation_events (user_id, created_at);

COMMENT ON TABLE public.report_generation_events IS 'Tracks report generation attempts per user for daily soft limits (API service role only).';

ALTER TABLE public.report_generation_events ENABLE ROW LEVEL SECURITY;
