-- supabase/migrations/022_remove_lock_window.sql

-- ============================================
-- Remove Abandoned Lock-Window Infrastructure
-- ============================================
--
-- migrations/013_match_lock_window.sql introduced a "universal lock window"
-- design (auto-lock 24h after creation, ratings applied then) that was
-- implemented once and then reverted in application code without anyone
-- updating these functions or the docs. This migration removes the parts of
-- that design that are dead from the application's perspective, replacing
-- it with a friendship-gated confirmation model implemented entirely in
-- TypeScript (see src/lib/supabase/ratings.ts:applyParticipantRating).
--
-- matches.locks_at the COLUMN is left in place (nullable, simply no longer
-- auto-populated) rather than dropped -- it's harmless historical data on
-- existing rows and dropping columns isn't worth the risk here.

-- Stop auto-populating locks_at on insert.
DROP TRIGGER IF EXISTS trg_set_match_locks_at ON matches;
DROP FUNCTION IF EXISTS set_match_locks_at();

-- Dead: only referenced by the abandoned lock-window design, never called
-- from application code.
DROP FUNCTION IF EXISTS is_match_locked(UUID);
DROP FUNCTION IF EXISTS get_lock_window_hours();
DROP FUNCTION IF EXISTS auto_confirm_match_participants(UUID);
DROP FUNCTION IF EXISTS process_expired_lock_windows();

-- Fix a latent bug uncovered while removing the above: mark_match_dirty()
-- only flagged a match dirty if its (now-removed) 24h lock window had
-- already passed, so editing a deck's bracket within the first day after
-- logging a match silently failed to flag it for recalculation even though
-- a rating may have already been applied (friend auto-confirm can apply a
-- rating within seconds of creation). The condition that actually matters
-- is whether a rating was ever applied, not how old the match is.
CREATE OR REPLACE FUNCTION mark_match_dirty(p_match_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE matches
  SET is_dirty = TRUE
  WHERE id = p_match_id
    AND ratings_applied_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_match_dirty(UUID) TO authenticated;

-- Drop the now-unused lock_window_hours key from match_settings, keep
-- backdate_limit_days (still read by editMatch()).
UPDATE app_settings
SET value = value - 'lock_window_hours'
WHERE key = 'match_settings';
