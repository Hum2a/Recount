-- Daily time series for staff analytics charts (signups, logins, tab activity, reports, intentions).
-- Apply after 008. RPC is service_role only.

CREATE OR REPLACE FUNCTION public.admin_analytics_timeseries(p_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH
  day_count AS (
    SELECT LEAST(GREATEST(COALESCE(p_days, 90), 7), 366)::int AS n
  ),
  bounds AS (
    SELECT
      (NOW() AT TIME ZONE 'utc')::date AS end_d,
      (NOW() AT TIME ZONE 'utc')::date - ((SELECT n FROM day_count) - 1) AS start_d
  ),
  series AS (
    SELECT generate_series((SELECT start_d FROM bounds), (SELECT end_d FROM bounds), '1 day'::interval)::date AS d
  ),
  signups AS (
    SELECT DATE(timezone('UTC', created_at)) AS day, COUNT(*)::int AS n
    FROM public.profiles
    WHERE created_at >= ((SELECT start_d FROM bounds) AT TIME ZONE 'UTC')
      AND created_at < (((SELECT end_d FROM bounds) + 1) AT TIME ZONE 'UTC')
    GROUP BY 1
  ),
  logins AS (
    SELECT
      DATE(timezone('UTC', occurred_at)) AS day,
      COUNT(*)::int AS total_events,
      COUNT(*) FILTER (WHERE event_type = 'login')::int AS login_only,
      COUNT(*) FILTER (WHERE event_type = 'signup')::int AS signup_events_logged
    FROM public.login_events
    WHERE occurred_at >= ((SELECT start_d FROM bounds) AT TIME ZONE 'UTC')
      AND occurred_at < (((SELECT end_d FROM bounds) + 1) AT TIME ZONE 'UTC')
    GROUP BY 1
  ),
  activity AS (
    SELECT
      date AS day,
      (COALESCE(SUM(duration_sec), 0) / 60)::bigint AS minutes,
      COUNT(*)::int AS segments,
      COUNT(DISTINCT user_id)::int AS active_users
    FROM public.tab_events
    WHERE date >= (SELECT start_d FROM bounds)
      AND date <= (SELECT end_d FROM bounds)
    GROUP BY 1
  ),
  reports_d AS (
    SELECT date AS day, COUNT(*)::int AS n
    FROM public.reports
    WHERE date >= (SELECT start_d FROM bounds)
      AND date <= (SELECT end_d FROM bounds)
    GROUP BY 1
  ),
  intentions_d AS (
    SELECT date AS day, COUNT(*)::int AS n
    FROM public.intentions
    WHERE date >= (SELECT start_d FROM bounds)
      AND date <= (SELECT end_d FROM bounds)
    GROUP BY 1
  )
SELECT jsonb_build_object(
  'days', (SELECT n FROM day_count),
  'start', (SELECT start_d FROM bounds)::text,
  'end', (SELECT end_d FROM bounds)::text,
  'daily', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', s.d::text,
        'signups', COALESCE(p.n, 0),
        'login_events', COALESCE(l.total_events, 0),
        'login_only', COALESCE(l.login_only, 0),
        'signup_events_logged', COALESCE(l.signup_events_logged, 0),
        'tracked_minutes', COALESCE(a.minutes, 0),
        'tab_segments', COALESCE(a.segments, 0),
        'active_users', COALESCE(a.active_users, 0),
        'reports', COALESCE(r.n, 0),
        'intentions', COALESCE(i.n, 0)
      ) ORDER BY s.d
    )
    FROM series s
    LEFT JOIN signups p ON p.day = s.d
    LEFT JOIN logins l ON l.day = s.d
    LEFT JOIN activity a ON a.day = s.d
    LEFT JOIN reports_d r ON r.day = s.d
    LEFT JOIN intentions_d i ON i.day = s.d
  ), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.admin_analytics_timeseries(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_analytics_timeseries(integer) TO service_role;
