-- ============================================
-- Fix: migration 025's anon REVOKE was a no-op
-- ============================================
--
-- Postgres grants EXECUTE to PUBLIC by default when a function is created,
-- unless explicitly revoked. None of migrations 006/007/012/014/017/020 ever
-- revoked PUBLIC, so all 11 functions targeted by migration 025 were (and,
-- until this migration runs, still are) executable by literally any role --
-- anon included -- via that PUBLIC grant, regardless of the anon-specific
-- REVOKE in 025. Verified live: has_function_privilege('anon',
-- 'apply_rating_change', 'EXECUTE') still returned true after 025 applied.
--
-- Fix: revoke PUBLIC directly, then grant explicitly only to the roles that
-- actually need access. service_role has never had its own explicit grant on
-- any of these 11 (it was also riding on PUBLIC), so it needs one now or the
-- maintenance scripts (which run with a secret key -> service_role) break.

-- ----------------------------------------
-- Group A: used by authenticated app / debug-endpoint paths.
-- Revoke PUBLIC, grant service_role + authenticated.
-- ----------------------------------------

REVOKE EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION update_user_rating(
  UUID, UUID, UUID, INTEGER, INTEGER, INTEGER
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_user_rating(
  UUID, UUID, UUID, INTEGER, INTEGER, INTEGER
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION upsert_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION clear_match_dirty_flag(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_match_dirty_flag(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_match_participants_for_recalc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_match_participants_for_recalc(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_rating_before_match(UUID, UUID, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_rating_before_match(UUID, UUID, UUID, TIMESTAMPTZ) TO authenticated, service_role;

-- ----------------------------------------
-- Group B: script-only, no src/ callers. Revoke PUBLIC, grant service_role only.
-- ----------------------------------------

REVOKE EXECUTE ON FUNCTION reset_ratings_for_recalculation(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reset_ratings_for_recalculation(BOOLEAN) TO service_role;

REVOKE EXECUTE ON FUNCTION delete_match_rating_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_match_rating_history(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION start_recalculation_log(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_recalculation_log(INTEGER, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION complete_recalculation_log(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION complete_recalculation_log(UUID, INTEGER, INTEGER, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION get_dirty_matches_batch(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dirty_matches_batch(INTEGER) TO service_role;
