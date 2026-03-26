-- supabase/migrations/004_get_user_recent_scores.sql
CREATE OR REPLACE FUNCTION get_user_recent_scores(p_user_id uuid, p_limit int)
RETURNS TABLE(set_date date, score_pct int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ds.set_date,
    ROUND(
      COUNT(*) FILTER (WHERE up.result = 'got_it') * 100.0 / COUNT(*)
    )::int AS score_pct
  FROM user_progress up
  JOIN daily_sets ds ON ds.id = up.set_id
  WHERE up.user_id = p_user_id
  GROUP BY ds.set_date, up.set_id
  ORDER BY ds.set_date DESC
  LIMIT p_limit;
$$;
