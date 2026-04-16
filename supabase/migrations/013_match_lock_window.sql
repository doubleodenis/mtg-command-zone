-- ============================================
-- Match Lock Window & Dirty Tracking
-- ============================================
--
-- Replaces per-participant confirmation with a universal lock window.
-- Matches auto-lock after 24h (configurable), at which point ratings are applied.
-- Participants can confirm early to lock their slot or make corrections during the window.
--
-- Changes:
-- 1. Add locks_at, is_dirty, last_recalculated_at to matches
-- 2. Add participant_status enum and column to match_participants
-- 3. Add ratings_applied_at to track when ratings were written
-- 4. Migrate existing confirmed_at data to new status system

-- ============================================
-- Participant Status Enum
-- ============================================

CREATE TYPE participant_status AS ENUM (
  'pending',        -- Awaiting confirmation or auto-lock
  'confirmed',      -- Manually confirmed by participant
  'auto_confirmed'  -- Automatically confirmed when lock window closed
);

-- ============================================
-- Matches Table Changes
-- ============================================

-- locks_at: When the match becomes immutable and ratings are applied
-- Default is 24 hours from creation (configured via app_settings)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS locks_at TIMESTAMPTZ;

-- is_dirty: Set to true when match is edited post-lock, requiring rating recalculation
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS is_dirty BOOLEAN NOT NULL DEFAULT FALSE;

-- last_recalculated_at: When the nightly recalc job last processed this match
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS last_recalculated_at TIMESTAMPTZ;

-- ratings_applied_at: When ratings were applied to the ratings table
-- NULL means ratings haven't been applied yet (match still in lock window)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS ratings_applied_at TIMESTAMPTZ;

-- Set locks_at for existing matches to their creation time (already locked)
UPDATE matches
SET locks_at = created_at
WHERE locks_at IS NULL;

-- Now make locks_at NOT NULL for future inserts
ALTER TABLE matches
ALTER COLUMN locks_at SET DEFAULT NOW() + INTERVAL '24 hours';

-- For existing matches, set ratings_applied_at to created_at (ratings already applied)
UPDATE matches m
SET ratings_applied_at = m.created_at
WHERE EXISTS (
  SELECT 1 FROM rating_history rh
  WHERE rh.match_id = m.id
);

-- Index for finding matches that need rating application (lock window expired, ratings not applied)
CREATE INDEX IF NOT EXISTS idx_matches_pending_lock
  ON matches(locks_at)
  WHERE ratings_applied_at IS NULL;

-- Index for dirty matches needing recalculation
CREATE INDEX IF NOT EXISTS idx_matches_dirty
  ON matches(played_at)
  WHERE is_dirty = TRUE;

-- ============================================
-- Match Participants Table Changes
-- ============================================

-- Add participant_status column
ALTER TABLE match_participants
ADD COLUMN IF NOT EXISTS participant_status participant_status NOT NULL DEFAULT 'pending';

-- Migrate existing data: confirmed_at IS NOT NULL → confirmed, else pending
-- Also migrate creator's slot (match created_by = user_id) to confirmed
UPDATE match_participants mp
SET participant_status = 
  CASE 
    WHEN confirmed_at IS NOT NULL THEN 'confirmed'::participant_status
    WHEN EXISTS (
      SELECT 1 FROM matches m 
      WHERE m.id = mp.match_id AND m.created_by = mp.user_id
    ) THEN 'confirmed'::participant_status
    ELSE 'pending'::participant_status
  END;

-- Set confirmed_at for creator slots that didn't have it
UPDATE match_participants mp
SET confirmed_at = (SELECT created_at FROM matches m WHERE m.id = mp.match_id)
WHERE confirmed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM matches m 
    WHERE m.id = mp.match_id AND m.created_by = mp.user_id
  );

-- Index for participant status queries
CREATE INDEX IF NOT EXISTS idx_match_participants_status
  ON match_participants(participant_status);

-- Index for finding pending participants in unlocked matches
CREATE INDEX IF NOT EXISTS idx_match_participants_pending_status
  ON match_participants(match_id)
  WHERE participant_status = 'pending';

-- ============================================
-- Functions for Lock Window Processing
-- ============================================

-- Check if a match is locked (past the lock window)
CREATE OR REPLACE FUNCTION is_match_locked(p_match_id UUID)
RETURNS BOOLEAN AS $$
  SELECT locks_at <= NOW()
  FROM matches
  WHERE id = p_match_id;
$$ LANGUAGE SQL STABLE;

-- Get lock window hours from app_settings (with fallback to 24)
CREATE OR REPLACE FUNCTION get_lock_window_hours()
RETURNS INTEGER AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  SELECT (value->>'lock_window_hours')::INTEGER INTO v_hours
  FROM app_settings
  WHERE key = 'match_settings';
  
  RETURN COALESCE(v_hours, 24);
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-confirm all pending participants for a match
CREATE OR REPLACE FUNCTION auto_confirm_match_participants(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE match_participants
  SET 
    participant_status = 'auto_confirmed',
    confirmed_at = NOW()
  WHERE match_id = p_match_id
    AND participant_status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auto_confirm_match_participants(UUID) TO authenticated;

-- Mark a match as dirty (for post-lock edits)
CREATE OR REPLACE FUNCTION mark_match_dirty(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET is_dirty = TRUE
  WHERE id = p_match_id
    AND locks_at <= NOW(); -- Only mark dirty if already locked
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_match_dirty(UUID) TO authenticated;

-- ============================================
-- Trigger: Set locks_at on Match Creation
-- ============================================

CREATE OR REPLACE FUNCTION set_match_locks_at()
RETURNS TRIGGER AS $$
DECLARE
  v_hours INTEGER;
BEGIN
  v_hours := get_lock_window_hours();
  NEW.locks_at := COALESCE(NEW.locks_at, NOW() + (v_hours || ' hours')::INTERVAL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_match_locks_at ON matches;
CREATE TRIGGER trg_set_match_locks_at
  BEFORE INSERT ON matches
  FOR EACH ROW
  EXECUTE FUNCTION set_match_locks_at();

-- ============================================
-- Backdate Limit Check
-- ============================================
-- Ensures played_at cannot be more than 30 days in the past

CREATE OR REPLACE FUNCTION check_played_at_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.played_at < NOW() - INTERVAL '30 days' THEN
    RAISE EXCEPTION 'played_at cannot be more than 30 days in the past';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_played_at_limit ON matches;
CREATE TRIGGER trg_check_played_at_limit
  BEFORE INSERT OR UPDATE OF played_at ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_played_at_limit();
