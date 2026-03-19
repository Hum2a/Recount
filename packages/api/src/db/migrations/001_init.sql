-- Run in Supabase SQL editor or via migration tool
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  license_active BOOLEAN NOT NULL DEFAULT FALSE,
  license_key TEXT UNIQUE,
  hourly_rate NUMERIC(8,2) DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.intentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  goals TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE public.tab_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  title TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_sec INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN end_time IS NOT NULL THEN (EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER)
      ELSE NULL
    END
  ) STORED,
  category TEXT,
  date DATE GENERATED ALWAYS AS (start_time::DATE) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ai_summary TEXT NOT NULL,
  score SMALLINT CHECK (score BETWEEN 1 AND 10),
  top_domains JSONB,
  goals_met TEXT[],
  goals_missed TEXT[],
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_id TEXT UNIQUE NOT NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tab_events_user_date ON public.tab_events(user_id, date);
CREATE INDEX idx_tab_events_domain ON public.tab_events(domain);
CREATE INDEX idx_intentions_user_date ON public.intentions(user_id, date);
CREATE INDEX idx_reports_user_date ON public.reports(user_id, date);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tab_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profiles" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users see own intentions" ON public.intentions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own tab_events" ON public.tab_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own reports" ON public.reports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own payments" ON public.payments
  FOR ALL USING (auth.uid() = user_id);
