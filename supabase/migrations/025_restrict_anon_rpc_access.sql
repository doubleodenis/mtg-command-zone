-- ============================================
-- Restrict anon Access to Privileged Rating RPCs
-- ============================================
--
-- Migrations 006/007/014/017 granted EXECUTE on several SECURITY DEFINER
-- functions to `anon` so recalculate-ratings.ts and recalculate-dirty-matches.ts
-- could run with the publishable (anon) key. None of these functions verify
-- the caller's identity — apply_rating_change trusts whatever p_user_id/p_delta
-- it's given — so granting them to `anon` meant anyone with the publishable key
-- (shipped in every browser bundle) could call e.g.
-- `/rest/v1/rpc/apply_rating_change` directly and set any player's rating to
-- an arbitrary value.
--
-- Fix: both scripts now connect with a secret key (service_role) instead of
-- the publishable key, so the anon grants are no longer needed.
--
-- Functions still called by the live app or the dev-only debug endpoint under
-- the `authenticated` role keep that grant; only `anon` is revoked for those.
-- Functions used exclusively by the maintenance scripts (confirmed via
-- grep across src/) lose both `anon` and `authenticated`, leaving only the
-- `service_role` access Supabase grants by default.

-- ----------------------------------------
-- Revoke anon only (still used by authenticated app / debug-endpoint paths)
-- ----------------------------------------

REVOKE EXECUTE ON FUNCTION apply_rating_change(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) FROM anon;

REVOKE EXECUTE ON FUNCTION update_user_rating(
  UUID, UUID, UUID, INTEGER, INTEGER, INTEGER
) FROM anon;

REVOKE EXECUTE ON FUNCTION upsert_rating_history(
  UUID, UUID, UUID, UUID,
  INTEGER, INTEGER, INTEGER, BOOLEAN,
  SMALLINT, NUMERIC, NUMERIC, SMALLINT, SMALLINT
) FROM anon;

REVOKE EXECUTE ON FUNCTION clear_match_dirty_flag(UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION get_match_participants_for_recalc(UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION get_rating_before_match(UUID, UUID, UUID, TIMESTAMPTZ) FROM anon;

-- ----------------------------------------
-- Revoke anon AND authenticated (script-only, no src/ callers)
-- ----------------------------------------

REVOKE EXECUTE ON FUNCTION reset_ratings_for_recalculation(BOOLEAN) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION delete_match_rating_history(UUID) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION start_recalculation_log(INTEGER, TEXT) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION complete_recalculation_log(UUID, INTEGER, INTEGER, TEXT) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION get_dirty_matches_batch(INTEGER) FROM anon, authenticated;
