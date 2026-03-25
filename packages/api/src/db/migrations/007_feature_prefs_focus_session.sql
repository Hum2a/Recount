-- Focus / digest / team prefs and optional Pomodoro session grouping on tab_events.
-- Apply after 006.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS distraction_domains TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intent_lock_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS send_tab_titles BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS team_slug TEXT,
  ADD COLUMN IF NOT EXISTS leaderboard_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS leaderboard_nickname TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_team_slug ON public.profiles (team_slug) WHERE team_slug IS NOT NULL;

ALTER TABLE public.tab_events
  ADD COLUMN IF NOT EXISTS focus_session_id UUID;

COMMENT ON COLUMN public.profiles.distraction_domains IS 'Hostnames (no www) for intent-lock distraction nudges; managed via API.';
COMMENT ON COLUMN public.tab_events.focus_session_id IS 'Optional client UUID grouping events into a focus/Pomodoro session.';
