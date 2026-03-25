-- Optional survey / demographics on profiles + login audit trail + staff-only audience RPC.
-- Apply after 007.
--
-- All new `profiles` columns below are voluntary: NOT NULL is not used; users may leave every field empty
-- forever. Signup and core product flows must not require any of these values.

-- --- Profile fields (optional; users edit via API; suitable for aggregate analytics) ---
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS birth_year SMALLINT,
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS locale TEXT,
  ADD COLUMN IF NOT EXISTS gender_identity TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS work_role TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS primary_use_case TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS demographics_updated_at TIMESTAMPTZ;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_birth_year_range;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= 2100));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_company_size_values;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_size_values
  CHECK (
    company_size IS NULL OR company_size IN (
      '1', '2-10', '11-50', '51-200', '201+', 'prefer_not_say'
    )
  );

COMMENT ON COLUMN public.profiles.display_name IS 'Preferred name (not required to match email).';
COMMENT ON COLUMN public.profiles.birth_year IS 'Optional; for cohort analytics. Prefer year over full DOB to reduce PII.';
COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2, uppercase.';
COMMENT ON COLUMN public.profiles.primary_use_case IS 'Free-text: main reason for using the product.';
COMMENT ON COLUMN public.profiles.referral_source IS 'How the user heard about the product (survey).';

-- --- Login / signup audit (API writes only; no JWT policies) ---
CREATE TABLE IF NOT EXISTS public.login_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type TEXT NOT NULL DEFAULT 'login' CHECK (event_type IN ('login', 'signup')),
  provider TEXT NOT NULL DEFAULT 'password',
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_events_user_occurred ON public.login_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_occurred ON public.login_events (occurred_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.login_events FROM PUBLIC;
GRANT ALL PRIVILEGES ON TABLE public.login_events TO service_role;

COMMENT ON TABLE public.login_events IS 'Password/API login and signup events for support and aggregate engagement metrics.';

-- --- Staff dashboard: one RPC (service_role execute only) ---
CREATE OR REPLACE FUNCTION public.admin_audience_dashboard()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH utc_today AS (
    SELECT (NOW() AT TIME ZONE 'utc')::date AS d
  ),
  bounds AS (
    SELECT (SELECT d - 30 FROM utc_today) AS d_from, (SELECT d FROM utc_today) AS d_to
  )
  SELECT jsonb_build_object(
    'generated_at', to_jsonb(NOW() AT TIME ZONE 'utc'),
    'profiles', (
      SELECT jsonb_build_object(
        'total', COUNT(*)::int,
        'licensed', COUNT(*) FILTER (WHERE license_active)::int,
        'with_any_demographic', COUNT(*) FILTER (
          WHERE display_name IS NOT NULL AND trim(display_name) <> ''
            OR birth_year IS NOT NULL
            OR country_code IS NOT NULL AND trim(country_code::text) <> ''
            OR industry IS NOT NULL AND trim(industry) <> ''
            OR occupation IS NOT NULL AND trim(occupation) <> ''
        )::int
      )
      FROM public.profiles
    ),
    'countries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', c, 'count', n) ORDER BY n DESC, c)
      FROM (
        SELECT upper(trim(both FROM country_code::text)) AS c, COUNT(*)::int AS n
        FROM public.profiles
        WHERE country_code IS NOT NULL AND trim(both FROM country_code::text) <> ''
        GROUP BY 1
      ) s
    ), '[]'::jsonb),
    'birth_years', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('year', y, 'count', n) ORDER BY y DESC)
      FROM (
        SELECT birth_year AS y, COUNT(*)::int AS n
        FROM public.profiles
        WHERE birth_year IS NOT NULL
        GROUP BY birth_year
      ) s
    ), '[]'::jsonb),
    'company_size', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('size', z, 'count', n) ORDER BY n DESC, z)
      FROM (
        SELECT company_size AS z, COUNT(*)::int AS n
        FROM public.profiles
        WHERE company_size IS NOT NULL
        GROUP BY company_size
      ) s
    ), '[]'::jsonb),
    'industries_top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', t, 'count', n) ORDER BY n DESC, t)
      FROM (
        SELECT trim(industry) AS t, COUNT(*)::int AS n
        FROM public.profiles
        WHERE industry IS NOT NULL AND trim(industry) <> ''
        GROUP BY trim(industry)
        ORDER BY n DESC
        LIMIT 25
      ) s
    ), '[]'::jsonb),
    'occupations_top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', t, 'count', n) ORDER BY n DESC, t)
      FROM (
        SELECT trim(occupation) AS t, COUNT(*)::int AS n
        FROM public.profiles
        WHERE occupation IS NOT NULL AND trim(occupation) <> ''
        GROUP BY trim(occupation)
        ORDER BY n DESC
        LIMIT 25
      ) s
    ), '[]'::jsonb),
    'referral_sources_top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', t, 'count', n) ORDER BY n DESC, t)
      FROM (
        SELECT trim(referral_source) AS t, COUNT(*)::int AS n
        FROM public.profiles
        WHERE referral_source IS NOT NULL AND trim(referral_source) <> ''
        GROUP BY trim(referral_source)
        ORDER BY n DESC
        LIMIT 25
      ) s
    ), '[]'::jsonb),
    'primary_use_cases_top', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', t, 'count', n) ORDER BY n DESC, t)
      FROM (
        SELECT trim(primary_use_case) AS t, COUNT(*)::int AS n
        FROM public.profiles
        WHERE primary_use_case IS NOT NULL AND trim(primary_use_case) <> ''
        GROUP BY trim(primary_use_case)
        ORDER BY n DESC
        LIMIT 25
      ) s
    ), '[]'::jsonb),
    'logins', (
      SELECT jsonb_build_object(
        'last_7d', (SELECT COUNT(*)::int FROM public.login_events WHERE occurred_at >= NOW() - INTERVAL '7 days'),
        'last_30d', (SELECT COUNT(*)::int FROM public.login_events WHERE occurred_at >= NOW() - INTERVAL '30 days'),
        'unique_users_30d', (SELECT COUNT(DISTINCT user_id)::int FROM public.login_events WHERE occurred_at >= NOW() - INTERVAL '30 days')
      )
    ),
    'domain_trends_30d_utc', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'domain', x.domain,
          'total_duration_sec', x.total_sec,
          'distinct_users', x.users
        )
        ORDER BY x.total_sec DESC NULLS LAST
      )
      FROM (
        SELECT
          te.domain,
          SUM(te.duration_sec)::bigint AS total_sec,
          COUNT(DISTINCT te.user_id)::int AS users
        FROM public.tab_events te, bounds b
        WHERE te.duration_sec IS NOT NULL
          AND te.date >= b.d_from
          AND te.date <= b.d_to
        GROUP BY te.domain
        ORDER BY total_sec DESC NULLS LAST
        LIMIT 50
      ) x
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_audience_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_audience_dashboard() TO service_role;
