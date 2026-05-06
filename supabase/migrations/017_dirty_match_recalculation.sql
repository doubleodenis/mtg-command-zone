-- ============================================
-- Dirty Match Recalculation Support
-- ============================================
--
-- Provides helper functions and infrastructure for the nightly dirty match
-- recalculation job. When a match is edited after ratings are applied,
-- the is_dirty flag is set and ratings need to be recalculated.
--
-- Architecture:
-- 1. pg_cron calls get_dirty_matches_batch() to get matches needing recalc
-- 2. An API route (or script) performs the TypeScript-based rating calculation
-- 3. Results are written via upsert_rating_history() and update_user_rating()
-- 4. clear_match_dirty_flag() is called after successful recalculation
--
-- The rating calculation logic lives in TypeScript (src/lib/rating.ts) because
-- it includes complex bracket modifiers and K-factor calculations that would
-- be error-prone to replicate in SQL.

-- ============================================
-- Recalculation Log Table
-- ============================================
-- Tracks each batch run for monitoring and debugging.

CREATE TABLE IF NOT EXISTS recalculation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  matches_processed INTEGER NOT NULL DEFAULT 0,
  matches_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  batch_size INTEGER NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'manual', 'api'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding recent runs
CREATE INDEX IF NOT EXISTS idx_recalculation_log_started
  ON recalculation_log(started_at DESC);

-- RLS: Admin-only access (or authenticated for monitoring)
ALTER TABLE recalculation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recalculation log viewable by authenticated users"
  ON recalculation_log FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Get Rating Before Match
-- ============================================
-- Returns a user's rating BEFORE a given match was played.
-- Used during recalculation to get the correct "rating_before" snapshot.
-- Returns the rating_after from the most recent match before played_at,
-- or the default rating (1000) if no prior history exists.

CREATE OR REPLACE FUNCTION get_rating_before_match(
  p_user_id UUID,
  p_format_id UUID,
  p_collection_id UUID,
  p_match_played_at TIMESTAMPTZ
)
RETURNS INTEGER AS $$
DECLARE
  v_rating INTEGER;
BEGIN
  -- Find the most recent rating_history entry for this user/format/collection
  -- that was created BEFORE the target match's played_at time
  SELECT rh.rating_after INTO v_rating
  FROM rating_history rh
  JOIN matches m ON rh.match_id = m.id
  WHERE rh.user_id = p_user_id
    AND rh.format_id = p_format_id
    AND rh.collection_id IS NOT DISTINCT FROM p_collection_id
    AND m.played_at < p_match_played_at
  ORDER BY m.played_at DESC
  LIMIT 1;

  -- If no prior history, return the default rating
  RETURN COALESCE(v_rating, 1000);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Delete Match Rating History
-- ============================================
-- Removes all rating_history entries for a specific match.
-- Used when recalculating a match from scratch.

CREATE OR REPLACE FUNCTION delete_match_rating_history(p_match_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM rating_history
  WHERE match_id = p_match_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_match_rating_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_match_rating_history(UUID) TO anon;

-- ============================================
-- Get Dirty Matches Batch
-- ============================================
-- Returns a batch of dirty matches for recalculation, ordered by played_at.
-- Includes match details needed for the recalculation process.

CREATE OR REPLACE FUNCTION get_dirty_matches_batch(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  match_id UUID,
  format_id UUID,
  played_at TIMESTAMPTZ,
  created_by UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    m.format_id,
    m.played_at,
    m.created_by
  FROM matches m
  WHERE m.is_dirty = TRUE
    AND m.ratings_applied_at IS NOT NULL  -- Only recalc matches that already had ratings
  ORDER BY m.played_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Get Match Participants For Recalc
-- ============================================
-- Returns participant data needed for rating recalculation.
-- Includes deck bracket info for the bracket modifier calculation.

CREATE OR REPLACE FUNCTION get_match_participants_for_recalc(p_match_id UUID)
RETURNS TABLE (
  participant_id UUID,
  user_id UUID,
  deck_id UUID,
  deck_bracket SMALLINT,
  is_winner BOOLEAN,
  team TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.id AS participant_id,
    mp.user_id,
    mp.deck_id,
    COALESCE(d.bracket, 2)::SMALLINT AS deck_bracket,  -- Default to bracket 2
    mp.is_winner,
    mp.team
  FROM match_participants mp
  LEFT JOIN decks d ON mp.deck_id = d.id
  WHERE mp.match_id = p_match_id
    AND mp.user_id IS NOT NULL;  -- Only real users, not placeholders
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Update User Rating (For Recalculation)
-- ============================================
-- Updates a user's current rating to a specific value.
-- Used during recalculation when we need to set the rating directly.
-- Also optionally adjusts matches_played and wins counts.

CREATE OR REPLACE FUNCTION update_user_rating(
  p_user_id UUID,
  p_format_id UUID,
  p_collection_id UUID,
  p_new_rating INTEGER,
  p_adjust_matches INTEGER DEFAULT 0,  -- Add/subtract from matches_played
  p_adjust_wins INTEGER DEFAULT 0      -- Add/subtract from wins
)
RETURNS VOID AS $$
BEGIN
  -- Ensure the rating row exists
  INSERT INTO ratings (user_id, format_id, collection_id)
  VALUES (p_user_id, p_format_id, p_collection_id)
  ON CONFLICT (user_id, format_id, collection_id) DO NOTHING;

  -- Update the rating
  UPDATE ratings
  SET
    rating = p_new_rating,
    matches_played = GREATEST(0, matches_played + p_adjust_matches),
    wins = GREATEST(0, wins + p_adjust_wins),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND format_id = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_user_rating(UUID, UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_rating(UUID, UUID, UUID, INTEGER, INTEGER, INTEGER) TO anon;

-- ============================================
-- Log Recalculation Run
-- ============================================
-- Creates a new recalculation log entry. Returns the log ID for updates.

CREATE OR REPLACE FUNCTION start_recalculation_log(
  p_batch_size INTEGER,
  p_triggered_by TEXT DEFAULT 'scheduled'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO recalculation_log (batch_size, triggered_by)
  VALUES (p_batch_size, p_triggered_by)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION start_recalculation_log(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_recalculation_log(INTEGER, TEXT) TO anon;

-- ============================================
-- Complete Recalculation Log
-- ============================================
-- Updates a recalculation log entry when processing completes.

CREATE OR REPLACE FUNCTION complete_recalculation_log(
  p_log_id UUID,
  p_matches_processed INTEGER,
  p_matches_failed INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE recalculation_log
  SET
    completed_at = NOW(),
    matches_processed = p_matches_processed,
    matches_failed = p_matches_failed,
    error_message = p_error_message
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_recalculation_log(UUID, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_recalculation_log(UUID, INTEGER, INTEGER, TEXT) TO anon;

-- ============================================
-- Grant anon access to existing functions
-- ============================================
-- The recalculation script may run with anon key (like the existing
-- recalculate-ratings.ts does), so we need to grant access.

GRANT EXECUTE ON FUNCTION clear_match_dirty_flag(UUID) TO anon;

GRANT EXECUTE ON FUNCTION upsert_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO anon;

-- ============================================
-- Comment on pg_cron Setup
-- ============================================
-- To enable the nightly recalculation job:
--
-- 1. Enable pg_cron extension in Supabase Dashboard:
--    Settings → Database → Extensions → pg_cron
--
-- 2. Enable pg_net extension (for webhook calls):
--    Settings → Database → Extensions → pg_net
--
-- 3. Schedule the job (run in SQL Editor):
--    SELECT cron.schedule(
--      'nightly-rating-recalc',
--      '0 4 * * *',  -- 4am UTC daily
--      $$
--        SELECT net.http_post(
--          url := 'https://your-site.com/api/cron/recalculate-ratings',
--          headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
--          body := '{"batchSize": 50}'::jsonb
--        );
--      $$
--    );
--
-- Alternatively, if you want to just flag matches and process via application:
--    SELECT cron.schedule(
--      'nightly-rating-recalc',
--      '0 4 * * *',
--      $$SELECT get_dirty_matches_batch(50)$$
--    );
--
-- Then have a separate application cron (Vercel/Netlify) poll get_dirty_matches_batch().
