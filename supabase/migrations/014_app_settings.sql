-- ============================================
-- App Settings Table
-- ============================================
--
-- Key-value store for application configuration.
-- Allows runtime configuration without code deploys.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Everyone can read, no direct writes (admin-managed)
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "App settings are viewable by everyone" ON app_settings;
CREATE POLICY "App settings are viewable by everyone"
  ON app_settings FOR SELECT
  USING (true);

-- ============================================
-- Seed Default Settings
-- ============================================

INSERT INTO app_settings (key, value, description) VALUES
  ('match_settings', '{"lock_window_hours": 24, "backdate_limit_days": 30}', 
   'Match creation and locking settings'),
  ('rating_settings', '{"default_rating": 1000, "algorithm_version": 1}',
   'Rating system configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- Helper Function: Get Setting
-- ============================================

CREATE OR REPLACE FUNCTION get_app_setting(p_key TEXT, p_path TEXT DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value
  FROM app_settings
  WHERE key = p_key;
  
  IF p_path IS NOT NULL THEN
    RETURN v_value->p_path;
  END IF;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Scheduled Jobs (pg_cron) — Architecture Notes
-- ============================================
--
-- These jobs should be created in Supabase dashboard or via pg_cron extension:
--
-- 1. Auto-lock expired matches (every 5 minutes):
--    SELECT cron.schedule('auto-lock-matches', '*/5 * * * *', $$
--      SELECT process_expired_lock_windows();
--    $$);
--
-- 2. Nightly rating recalculation (3am UTC):
--    SELECT cron.schedule('nightly-rating-recalc', '0 3 * * *', $$
--      SELECT recalculate_dirty_matches();
--    $$);
--
-- The functions referenced above are defined in separate migrations or
-- can be called from application code as needed.

-- ============================================
-- Process Expired Lock Windows Function
-- ============================================
-- Called by scheduled job to apply ratings for matches whose lock window has expired.
-- This is a stub — actual rating application is done via application code.

CREATE OR REPLACE FUNCTION process_expired_lock_windows()
RETURNS TABLE (
  match_id UUID,
  participant_count INTEGER
) AS $$
BEGIN
  -- Return matches that are past lock window but haven't had ratings applied
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    COALESCE(
      (SELECT COUNT(*)::INTEGER FROM match_participants mp WHERE mp.match_id = m.id),
      0
    ) AS participant_count
  FROM matches m
  WHERE m.locks_at <= NOW()
    AND m.ratings_applied_at IS NULL
  ORDER BY m.locks_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Get Dirty Matches Function
-- ============================================
-- Returns matches needing recalculation, ordered by played_at for chronological processing.

CREATE OR REPLACE FUNCTION get_dirty_matches()
RETURNS TABLE (
  match_id UUID,
  format_id UUID,
  played_at TIMESTAMPTZ,
  participant_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id AS match_id,
    m.format_id,
    m.played_at,
    COALESCE(
      (SELECT COUNT(*)::INTEGER FROM match_participants mp WHERE mp.match_id = m.id),
      0
    ) AS participant_count
  FROM matches m
  WHERE m.is_dirty = TRUE
  ORDER BY m.played_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Clear Dirty Flag Function
-- ============================================

CREATE OR REPLACE FUNCTION clear_match_dirty_flag(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET 
    is_dirty = FALSE,
    last_recalculated_at = NOW()
  WHERE id = p_match_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION clear_match_dirty_flag(UUID) TO authenticated;

-- ============================================
-- Mark Ratings Applied Function
-- ============================================

CREATE OR REPLACE FUNCTION mark_ratings_applied(p_match_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET ratings_applied_at = NOW()
  WHERE id = p_match_id
    AND ratings_applied_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_ratings_applied(UUID) TO authenticated;
