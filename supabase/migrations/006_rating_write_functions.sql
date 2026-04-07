-- ============================================
-- Rating Write Functions
-- ============================================
--
-- The ratings and rating_history tables have only SELECT RLS policies
-- ("system-managed via triggers/functions, no direct user writes").
-- All writes must go through SECURITY DEFINER functions that bypass RLS,
-- matching the existing get_or_create_rating pattern.
--
-- apply_rating_change: Atomically updates a user's rating and inserts a
-- rating_history row in a single transaction. Called via RPC from server
-- actions after a match is confirmed or logged.

CREATE OR REPLACE FUNCTION apply_rating_change(
  p_user_id              UUID,
  p_match_id             UUID,
  p_format_id            UUID,
  p_collection_id        UUID,
  p_new_rating           INTEGER,
  p_delta                INTEGER,
  p_is_win               BOOLEAN,
  p_player_bracket       SMALLINT,
  p_opponent_avg_rating  NUMERIC,
  p_opponent_avg_bracket NUMERIC,
  p_k_factor             SMALLINT,
  p_algorithm_version    SMALLINT
)
RETURNS VOID AS $$
DECLARE
  v_rating_before INTEGER;
BEGIN
  -- Lock the rating row and get the current value.
  -- Ensures matches_played is incremented correctly under concurrent writes.
  SELECT rating INTO v_rating_before
  FROM ratings
  WHERE user_id       = p_user_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id
  FOR UPDATE;

  -- Row may not exist yet on first match in this format/collection.
  -- Insert at the default rating (1000) so the history snapshot is accurate.
  IF v_rating_before IS NULL THEN
    INSERT INTO ratings (user_id, format_id, collection_id)
    VALUES (p_user_id, p_format_id, p_collection_id)
    RETURNING rating INTO v_rating_before;
  END IF;

  -- Apply the calculated rating change
  UPDATE ratings
  SET
    rating         = p_new_rating,
    matches_played = matches_played + 1,
    wins           = wins + (CASE WHEN p_is_win THEN 1 ELSE 0 END),
    updated_at     = NOW()
  WHERE user_id       = p_user_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;

  -- Record an immutable history snapshot
  INSERT INTO rating_history (
    user_id,
    match_id,
    format_id,
    collection_id,
    rating_before,
    rating_after,
    delta,
    is_win,
    player_bracket,
    opponent_avg_rating,
    opponent_avg_bracket,
    k_factor,
    algorithm_version
  ) VALUES (
    p_user_id,
    p_match_id,
    p_format_id,
    p_collection_id,
    v_rating_before,
    p_new_rating,
    p_delta,
    p_is_win,
    p_player_bracket,
    p_opponent_avg_rating,
    p_opponent_avg_bracket,
    p_k_factor,
    p_algorithm_version
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users so server actions can call it via RPC
GRANT EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated;
