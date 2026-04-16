-- ============================================
-- Rating History: Rewritability for Recalculation
-- ============================================
--
-- Removes immutability from rating_history — rows are now rewritable by the
-- system (via SECURITY DEFINER functions), never directly by users.
--
-- Changes:
-- 1. Add `recalculated_at` column to track when a row was last rewritten
-- 2. Create `update_rating_history` function for recalculation jobs
-- 3. Create `recalculate_match_ratings` function for dirty match processing

-- Add recalculated_at column to rating_history
ALTER TABLE rating_history
ADD COLUMN IF NOT EXISTS recalculated_at TIMESTAMPTZ;

-- Index for finding recalculated entries (for audit/debugging)
CREATE INDEX IF NOT EXISTS idx_rating_history_recalculated
  ON rating_history(recalculated_at)
  WHERE recalculated_at IS NOT NULL;

-- ============================================
-- Update Rating History Function
-- ============================================
-- Used by recalculation jobs to rewrite existing rating_history rows.
-- Sets recalculated_at timestamp when updating.

CREATE OR REPLACE FUNCTION update_rating_history(
  p_user_id              UUID,
  p_match_id             UUID,
  p_format_id            UUID,
  p_collection_id        UUID,
  p_rating_before        INTEGER,
  p_rating_after         INTEGER,
  p_delta                INTEGER,
  p_is_win               BOOLEAN,
  p_player_bracket       SMALLINT,
  p_opponent_avg_rating  NUMERIC,
  p_opponent_avg_bracket NUMERIC,
  p_k_factor             SMALLINT,
  p_algorithm_version    SMALLINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE rating_history
  SET
    rating_before        = p_rating_before,
    rating_after         = p_rating_after,
    delta                = p_delta,
    is_win               = p_is_win,
    player_bracket       = p_player_bracket,
    opponent_avg_rating  = p_opponent_avg_rating,
    opponent_avg_bracket = p_opponent_avg_bracket,
    k_factor             = p_k_factor,
    algorithm_version    = p_algorithm_version,
    recalculated_at      = NOW()
  WHERE user_id       = p_user_id
    AND match_id      = p_match_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated (for server actions calling via RPC)
GRANT EXECUTE ON FUNCTION update_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated;

-- ============================================
-- Upsert Rating History Function
-- ============================================
-- Combined insert-or-update for rating history.
-- Used when applying ratings — inserts new rows or updates existing ones.

CREATE OR REPLACE FUNCTION upsert_rating_history(
  p_user_id              UUID,
  p_match_id             UUID,
  p_format_id            UUID,
  p_collection_id        UUID,
  p_rating_before        INTEGER,
  p_rating_after         INTEGER,
  p_delta                INTEGER,
  p_is_win               BOOLEAN,
  p_player_bracket       SMALLINT,
  p_opponent_avg_rating  NUMERIC,
  p_opponent_avg_bracket NUMERIC,
  p_k_factor             SMALLINT,
  p_algorithm_version    SMALLINT
)
RETURNS VOID AS $$
BEGIN
  -- Try to update existing row first
  UPDATE rating_history
  SET
    rating_before        = p_rating_before,
    rating_after         = p_rating_after,
    delta                = p_delta,
    is_win               = p_is_win,
    player_bracket       = p_player_bracket,
    opponent_avg_rating  = p_opponent_avg_rating,
    opponent_avg_bracket = p_opponent_avg_bracket,
    k_factor             = p_k_factor,
    algorithm_version    = p_algorithm_version,
    recalculated_at      = NOW()
  WHERE user_id       = p_user_id
    AND match_id      = p_match_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;

  -- If no row was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO rating_history (
      user_id, match_id, format_id, collection_id,
      rating_before, rating_after, delta, is_win,
      player_bracket, opponent_avg_rating, opponent_avg_bracket,
      k_factor, algorithm_version
    ) VALUES (
      p_user_id, p_match_id, p_format_id, p_collection_id,
      p_rating_before, p_rating_after, p_delta, p_is_win,
      p_player_bracket, p_opponent_avg_rating, p_opponent_avg_bracket,
      p_k_factor, p_algorithm_version
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated;
