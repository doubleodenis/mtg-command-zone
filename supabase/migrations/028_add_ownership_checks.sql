-- ============================================
-- Add caller-ownership checks to SECURITY DEFINER functions
-- ============================================
--
-- Migration 027 decided *who* may call each routine. It does not constrain
-- *what* they may pass. Every function below is SECURITY DEFINER, so it runs
-- as the owner and bypasses RLS, and each one accepted a target id straight
-- from the caller without checking it against auth.uid():
--
--   * apply_rating_change(p_user_id, ..., p_new_rating, ...) -- any signed-in
--     user could set ANY player's rating to ANY value and write a matching
--     rating_history row. For an ELO tracker this is the whole ballgame.
--   * mark_notifications_read / _seen / dismiss_notifications and the two
--     count functions -- any signed-in user could read or mutate any other
--     user's notification state by passing their uuid.
--   * mark_ratings_applied / mark_match_dirty -- any signed-in user could
--     flip rating bookkeeping on matches they have nothing to do with.
--
-- Note that the `ratings` and `rating_history` tables have RLS enabled with
-- NO write policies at all, so these functions are the *only* write path to
-- them. That is why the checks belong here rather than in table policies.
--
-- Bypass rule: every check is skipped when auth.uid() IS NULL. That is the
-- service_role / maintenance-script case (scripts/recalculate-ratings.ts and
-- recalculate-dirty-matches.ts run with SUPABASE_SECRET_KEY and legitimately
-- rewrite other users' ratings), and also how the pg_cron nightly recalc runs.
--
-- Each function rewritten here also gains SET search_path = public, pg_temp.
-- An unpinned search_path on a SECURITY DEFINER function lets a caller who
-- can create objects in a schema earlier on the path shadow a table or
-- function name and have it run as the owner (Supabase lint 0011). Only the
-- 9 routines this migration already rewrites are pinned; the remaining ~37
-- still carry the warning and need a follow-up migration.
--
-- Why the rating check is "both are participants of this match" and not
-- "p_user_id = auth.uid()": logMatch auto-confirms accepted friends and
-- applies their ratings from the *reporter's* session (see the friendship-
-- gated auto-confirm in src/app/actions/match.ts). A strict self-only check
-- would break that feature. Requiring both the caller and the target to be
-- participants of the same match still removes the ability to touch
-- arbitrary users, which is the actual vulnerability.

-- ----------------------------------------
-- Notifications: the recipient must be the caller.
-- ----------------------------------------

CREATE OR REPLACE FUNCTION mark_notifications_seen(p_recipient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify another user''s notifications';
  END IF;

  UPDATE notifications
  SET seen_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND seen_at IS NULL
    AND dismissed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- NOTE: p_notification_ids keeps its DEFAULT NULL. Callers (and PostgREST)
-- omit it to mean "all", and CREATE OR REPLACE cannot drop an existing
-- parameter default anyway.
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_recipient_id UUID,
  p_notification_ids UUID[] DEFAULT NULL::UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify another user''s notifications';
  END IF;

  IF p_notification_ids IS NULL THEN
    UPDATE notifications
    SET read_at = NOW(),
        seen_at = COALESCE(seen_at, NOW())
    WHERE recipient_id = p_recipient_id
      AND read_at IS NULL
      AND dismissed_at IS NULL;
  ELSE
    UPDATE notifications
    SET read_at = NOW(),
        seen_at = COALESCE(seen_at, NOW())
    WHERE recipient_id = p_recipient_id
      AND id = ANY(p_notification_ids)
      AND read_at IS NULL
      AND dismissed_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION dismiss_notifications(
  p_recipient_id UUID,
  p_notification_ids UUID[] DEFAULT NULL::UUID[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify another user''s notifications';
  END IF;

  IF p_notification_ids IS NULL THEN
    UPDATE notifications
    SET dismissed_at = NOW()
    WHERE recipient_id = p_recipient_id
      AND dismissed_at IS NULL;
  ELSE
    UPDATE notifications
    SET dismissed_at = NOW()
    WHERE recipient_id = p_recipient_id
      AND id = ANY(p_notification_ids)
      AND dismissed_at IS NULL;
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_recipient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to read another user''s notifications';
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE recipient_id = p_recipient_id
      AND read_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION get_unseen_notification_count(p_recipient_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND p_recipient_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not authorized to read another user''s notifications';
  END IF;

  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE recipient_id = p_recipient_id
      AND seen_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$function$;

-- ----------------------------------------
-- Match rating bookkeeping: the caller must be in the match.
-- ----------------------------------------

CREATE OR REPLACE FUNCTION mark_ratings_applied(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a participant of this match';
  END IF;

  UPDATE matches
  SET ratings_applied_at = NOW()
  WHERE id = p_match_id
    AND ratings_applied_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION mark_match_dirty(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_updated INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = p_match_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a participant of this match';
  END IF;

  UPDATE matches
  SET is_dirty = TRUE
  WHERE id = p_match_id
    AND ratings_applied_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$function$;

-- ----------------------------------------
-- The rating write path itself.
-- ----------------------------------------

CREATE OR REPLACE FUNCTION apply_rating_change(
  p_user_id UUID,
  p_match_id UUID,
  p_format_id UUID,
  p_collection_id UUID,
  p_new_rating INTEGER,
  p_delta INTEGER,
  p_is_win BOOLEAN,
  p_player_bracket SMALLINT,
  p_opponent_avg_rating NUMERIC,
  p_opponent_avg_bracket NUMERIC,
  p_k_factor SMALLINT,
  p_algorithm_version SMALLINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rating_before INTEGER;
BEGIN
  -- Ownership gate (skipped for service_role / pg_cron, where auth.uid() is
  -- NULL). Both the caller and the rated user must belong to this match, so
  -- a signed-in user can no longer rewrite the rating of someone they have
  -- never played against.
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM match_participants
      WHERE match_id = p_match_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'not authorized: caller is not a participant of this match';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM match_participants
      WHERE match_id = p_match_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'not authorized: target user is not a participant of this match';
    END IF;
  END IF;

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

  UPDATE ratings
  SET
    rating         = p_new_rating,
    matches_played = matches_played + 1,
    wins           = wins + (CASE WHEN p_is_win THEN 1 ELSE 0 END),
    updated_at     = NOW()
  WHERE user_id       = p_user_id
    AND format_id     = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;

  INSERT INTO rating_history (
    user_id, match_id, format_id, collection_id,
    rating_before, rating_after, delta, is_win,
    player_bracket, opponent_avg_rating, opponent_avg_bracket,
    k_factor, algorithm_version
  ) VALUES (
    p_user_id, p_match_id, p_format_id, p_collection_id,
    v_rating_before, p_new_rating, p_delta, p_is_win,
    p_player_bracket, p_opponent_avg_rating, p_opponent_avg_bracket,
    p_k_factor, p_algorithm_version
  )
  ON CONFLICT DO NOTHING;
END;
$function$;

-- ----------------------------------------
-- Table-level: stop a participant editing the match *result* on their own row
-- ----------------------------------------
--
-- The "Participant can confirm own slot" policy on match_participants is
-- USING (auth.uid() = user_id) with no column restriction, and Postgres RLS
-- cannot express one. So a player confirming their own slot could also flip
-- their own is_winner to true (or reassign the row to another match) and then
-- have a rating applied off the back of it. The legitimate self-service
-- columns are participant_status / confirmed_at (confirmation), deck_id
-- (the "Unknown Deck" backfill) and the claim columns, which are governed by
-- their own policy. Result columns belong to the match creator.

CREATE OR REPLACE FUNCTION enforce_participant_self_update_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- service_role / triggers / pg_cron
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The match creator owns the result and may edit it.
  IF EXISTS (
    SELECT 1 FROM matches
    WHERE id = NEW.match_id AND created_by = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Claiming an empty placeholder slot for yourself is legitimate and is
  -- done by the claimer, not the match creator (claimSlotWithAutoApproval in
  -- src/app/actions/match.ts). Allow only the NULL -> self transition, which
  -- still blocks reassigning a slot to a third party or taking over a slot
  -- that already belongs to someone.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT (OLD.user_id IS NULL AND NEW.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized: cannot reassign a participant slot';
  END IF;

  IF NEW.is_winner IS DISTINCT FROM OLD.is_winner
     OR NEW.team     IS DISTINCT FROM OLD.team
     OR NEW.match_id IS DISTINCT FROM OLD.match_id THEN
    RAISE EXCEPTION 'not authorized: only the match creator can change the match result';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_participant_self_update_columns ON match_participants;
CREATE TRIGGER trg_participant_self_update_columns
  BEFORE UPDATE ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION enforce_participant_self_update_columns();

-- The new trigger function must not be left executable by end users; 027's
-- allowlist runs before this migration exists, so lock it down explicitly.
REVOKE ALL ON FUNCTION enforce_participant_self_update_columns() FROM PUBLIC, anon, authenticated;
