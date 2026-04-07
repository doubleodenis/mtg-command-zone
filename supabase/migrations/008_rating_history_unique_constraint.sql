-- ============================================
-- Rating History: Unique Constraint + Idempotent apply_rating_change
-- ============================================
--
-- Adds a unique constraint on rating_history so a player cannot receive
-- two separate rating entries for the same match in the same scope
-- (global or collection-scoped). This prevents double-application when:
--   - A match is added to a collection after the participant already confirmed
--   - A match is removed and re-added to a collection
--
-- The apply_rating_change function is updated to use ON CONFLICT DO NOTHING
-- so re-runs are silently ignored rather than erroring or double-counting.

-- Add unique constraint: one history entry per user/match/format/collection combo.
-- NULL collection_id is handled by the partial unique index below since
-- standard UNIQUE constraints treat NULL != NULL in Postgres.

-- Index for non-null collection_id (standard unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_history_scoped
  ON rating_history (user_id, match_id, format_id, collection_id)
  WHERE collection_id IS NOT NULL;

-- Index for global (null collection_id) entries
CREATE UNIQUE INDEX IF NOT EXISTS uq_rating_history_global
  ON rating_history (user_id, match_id, format_id)
  WHERE collection_id IS NULL;

-- Update apply_rating_change to be idempotent.
-- ON CONFLICT DO NOTHING means a second call for the same
-- user/match/format/collection is silently ignored, preserving whatever
-- rating and history row was written on the first call.

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
  -- Skip if a rating history entry already exists for this match/scope.
  -- This makes the function idempotent and prevents double-application.
  IF EXISTS (
    SELECT 1
    FROM rating_history
    WHERE user_id       = p_user_id
      AND match_id      = p_match_id
      AND format_id     = p_format_id
      AND collection_id IS NOT DISTINCT FROM p_collection_id
  ) THEN
    RETURN;
  END IF;

  -- Lock the rating row and get the current value.
  SELECT rating INTO v_rating_before
  FROM ratings
  WHERE user_id       = p_user_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id
  FOR UPDATE;

  -- Row may not exist yet on first match in this format/collection.
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
  )
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute (SECURITY DEFINER functions need explicit grants after replace)
GRANT EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated;
