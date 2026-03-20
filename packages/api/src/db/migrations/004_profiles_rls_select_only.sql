-- Prevent browser clients (anon key + user JWT) from updating privileged columns on their own row.
-- Profile updates for normal users go through the Express API (service role), which bypasses RLS.
-- Without this, FOR ALL could allow UPDATE ... SET app_role = 'admin' using the Supabase JS client.

DROP POLICY IF EXISTS "Users see own profiles" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
