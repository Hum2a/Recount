-- Aggregates for admin Activity tab (service role / RPC only). Safe substring match: pass pre-sanitized p_domain_sub from API (no % or _).
CREATE OR REPLACE FUNCTION public.admin_tab_event_summary(
  p_user_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_domain_sub text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_min_duration_sec integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT e.domain, e.duration_sec, e.date, e.category
    FROM public.tab_events e
    WHERE e.user_id = p_user_id
      AND (p_from IS NULL OR e.date >= p_from)
      AND (p_to IS NULL OR e.date <= p_to)
      AND (
        p_domain_sub IS NULL OR length(trim(p_domain_sub)) = 0 OR
        e.domain ILIKE '%' || trim(p_domain_sub) || '%'
      )
      AND (
        p_category IS NULL OR length(trim(p_category)) = 0 OR e.category = trim(p_category)
      )
      AND (
        p_min_duration_sec IS NULL OR (e.duration_sec IS NOT NULL AND e.duration_sec >= p_min_duration_sec)
      )
  ),
  tops AS (
    SELECT domain, SUM(duration_sec)::bigint AS sec
    FROM filtered
    WHERE duration_sec IS NOT NULL
    GROUP BY domain
    ORDER BY sec DESC NULLS LAST
    LIMIT 10
  ),
  cats AS (
    SELECT DISTINCT trim(category) AS c
    FROM filtered
    WHERE category IS NOT NULL AND length(trim(category)) > 0
    ORDER BY 1
    LIMIT 80
  )
  SELECT jsonb_build_object(
    'event_count', (SELECT COUNT(*)::bigint FROM filtered),
    'total_duration_sec', COALESCE((SELECT SUM(duration_sec)::bigint FROM filtered), 0),
    'completed_duration_rows', (SELECT COUNT(*)::bigint FROM filtered WHERE duration_sec IS NOT NULL),
    'distinct_days', (SELECT COUNT(DISTINCT date)::integer FROM filtered),
    'avg_duration_sec', (
      SELECT CASE WHEN COUNT(*) FILTER (WHERE duration_sec IS NOT NULL) > 0
        THEN ROUND(AVG(duration_sec) FILTER (WHERE duration_sec IS NOT NULL))::bigint
        ELSE NULL
      END FROM filtered
    ),
    'top_domains', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('domain', domain, 'duration_sec', sec) ORDER BY sec DESC NULLS LAST)
      FROM tops
    ), '[]'::jsonb),
    'categories', COALESCE((SELECT jsonb_agg(c ORDER BY c) FROM cats), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_tab_event_summary(uuid, date, date, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_tab_event_summary(uuid, date, date, text, text, integer) TO service_role;
