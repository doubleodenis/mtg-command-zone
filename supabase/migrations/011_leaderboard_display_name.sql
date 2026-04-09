-- Update get_leaderboard function to include display_name
-- This supports the display name feature for user profiles

-- Drop the existing function first since we're changing its return type
DROP FUNCTION IF EXISTS get_leaderboard(UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_leaderboard(
  p_format_id UUID,
  p_collection_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  rating INTEGER,
  matches_played INTEGER,
  wins BIGINT,
  win_rate NUMERIC,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_ratings AS (
    SELECT
      r.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      r.rating,
      r.matches_played,
      RANK() OVER (ORDER BY r.rating DESC) AS rank
    FROM ratings r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.format_id = p_format_id
      AND r.collection_id IS NOT DISTINCT FROM p_collection_id
      AND r.matches_played > 0
  ),
  user_wins AS (
    SELECT
      mp.user_id,
      COUNT(*) FILTER (WHERE mp.is_winner) AS wins,
      COUNT(*) AS total
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE m.format_id = p_format_id
      AND mp.confirmed_at IS NOT NULL
      AND (
        p_collection_id IS NULL
        OR EXISTS (
          SELECT 1 FROM collection_matches cm
          WHERE cm.match_id = m.id
          AND cm.collection_id = p_collection_id
          AND cm.approval_status = 'approved'
        )
      )
    GROUP BY mp.user_id
  )
  SELECT
    rr.user_id,
    rr.username,
    rr.display_name,
    rr.avatar_url,
    rr.rating,
    rr.matches_played,
    COALESCE(uw.wins, 0)::BIGINT,
    CASE
      WHEN COALESCE(uw.total, 0) > 0
      THEN ROUND((uw.wins::NUMERIC / uw.total::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate,
    rr.rank
  FROM ranked_ratings rr
  LEFT JOIN user_wins uw ON uw.user_id = rr.user_id
  ORDER BY rr.rank
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
