-- JWT clients: SELECT own rows on app tables; admin/developer SELECT all rows on those tables.
-- Uses SECURITY DEFINER helper so policies do not recurse through profiles RLS.
-- Writes remain API (service_role) only — no INSERT/UPDATE/DELETE policies for authenticated.
-- Apply after 009.

CREATE OR REPLACE FUNCTION public.current_user_is_elevated_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND app_role IN ('admin', 'developer')
  );
$$;

COMMENT ON FUNCTION public.current_user_is_elevated_staff() IS 'True when JWT subject has profiles.app_role admin or developer; used in RLS (bypasses RLS inside function).';

REVOKE ALL ON FUNCTION public.current_user_is_elevated_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_is_elevated_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_elevated_staff() TO service_role;

-- ---- profiles: replace single policy with own-row OR staff sees all ----
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

CREATE POLICY profiles_select_own_or_staff ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.current_user_is_elevated_staff());

-- ---- intentions, tab_events, reports, payments, login_events ----
CREATE POLICY intentions_select_own_or_staff ON public.intentions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_elevated_staff());

CREATE POLICY tab_events_select_own_or_staff ON public.tab_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_elevated_staff());

CREATE POLICY reports_select_own_or_staff ON public.reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_elevated_staff());

CREATE POLICY payments_select_own_or_staff ON public.payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_elevated_staff());

CREATE POLICY login_events_select_own_or_staff ON public.login_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_is_elevated_staff());

GRANT SELECT ON TABLE public.intentions TO authenticated;
GRANT SELECT ON TABLE public.tab_events TO authenticated;
GRANT SELECT ON TABLE public.reports TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.login_events TO authenticated;
