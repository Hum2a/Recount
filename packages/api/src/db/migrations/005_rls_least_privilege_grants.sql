-- Least privilege for PostgREST (anon key + user JWT):
-- App data is read/written only via the Express API (Supabase service_role), which bypasses RLS.
-- Removing authenticated policies on these tables denies direct client access even if RLS were misconfigured.
--
-- profiles: keep RLS policy profiles_select_own (004); add table GRANTs so only SELECT is possible for JWTs.
--
-- If you later expose a table via Supabase client or Realtime, add explicit RLS policies + GRANTs for that use case.

-- ---- intentions, tab_events, reports, payments: no JWT access ----
DROP POLICY IF EXISTS "Users see own intentions" ON public.intentions;
DROP POLICY IF EXISTS "Users see own tab_events" ON public.tab_events;
DROP POLICY IF EXISTS "Users see own reports" ON public.reports;
DROP POLICY IF EXISTS "Users see own payments" ON public.payments;

REVOKE ALL PRIVILEGES ON TABLE public.intentions FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.tab_events FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.reports FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.payments FROM PUBLIC;

GRANT ALL PRIVILEGES ON TABLE public.intentions TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.tab_events TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.reports TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.payments TO service_role;

-- ---- profiles: JWT may SELECT own row only (RLS + GRANT) ----
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM PUBLIC;

GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;
