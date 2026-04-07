-- ============================================
-- Rating Recalculation Support Functions
-- ============================================
--
-- The recalculate-ratings script runs with the publishable (anon) key and
-- cannot write directly to system-managed tables (ratings, rating_history).
-- These SECURITY DEFINER functions provide the two privileged operations the
-- script needs, callable via RPC from any authenticated or anon context.
--
-- reset_ratings_for_recalculation:
--   Wipes all rating_history rows and resets every ratings row to defaults.
--   Must be called before replaying matches.
--
-- apply_rating_change (migration 006):
--   Atomically applies a single participant's delta and records history.
--   Grant below extends it to the anon role so the script can call it.

-- ----------------------------------------
-- reset function
-- ----------------------------------------

CREATE OR REPLACE FUNCTION reset_ratings_for_recalculation(confirm_reset BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
  IF confirm_reset IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Safety check failed: pass confirm_reset := TRUE to proceed';
  END IF;

  DELETE FROM rating_history WHERE TRUE;

  UPDATE ratings
  SET
    rating         = 1000,
    matches_played = 0,
    wins           = 0,
    updated_at     = NOW()
  WHERE TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------
-- Grants — allow the publishable (anon) key to call both functions
-- ----------------------------------------

GRANT EXECUTE ON FUNCTION reset_ratings_for_recalculation(BOOLEAN) TO anon;

GRANT EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO anon;
