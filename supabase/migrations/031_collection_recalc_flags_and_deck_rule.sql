-- ============================================
-- Collection recalc flags, real auto-confirm, and "deck required to confirm"
-- ============================================
--
-- Migration 028 requires the caller of apply_rating_change to be a
-- participant of the match, and only the match creator may update other
-- players' match_participants rows. Collection actions (a member joining,
-- a match added/approved, auto-confirm) act on OTHER players' matches, so
-- from the actor's session they failed silently whenever the actor wasn't in
-- the match. Collection-scope ratings are now written by the nightly replay
-- (migration 030, .github/workflows/nightly-rating-recalc.yml); these
-- functions only confirm and flag, after checking collection membership here.
--
-- The deck rule (playtest feedback F4): a confirmation only counts with a real
-- deck. Enforced as a trigger so every path — confirmMatch, friend
-- auto-confirm, claims, collection auto-confirm, direct REST — obeys it. Only
-- the unconfirmed→confirmed transition is checked, so rows confirmed before
-- this migration are left as they are.

CREATE OR REPLACE FUNCTION mark_collection_matches_dirty(
  p_collection_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_match_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a member of this collection';
  END IF;

  UPDATE matches m
  SET is_dirty = TRUE
  WHERE m.id IN (
      SELECT cm.match_id FROM collection_matches cm
      WHERE cm.collection_id = p_collection_id
        AND cm.approval_status = 'approved'
        AND (p_match_id IS NULL OR cm.match_id = p_match_id)
    )
    AND EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = m.id
        AND mp.user_id IS NOT NULL
        AND mp.confirmed_at IS NOT NULL
        AND (p_user_id IS NULL OR mp.user_id = p_user_id)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION auto_confirm_collection_members(
  p_match_id UUID,
  p_collection_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = p_collection_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not authorized: caller is not a member of this collection';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id AND auto_approve_members) THEN
    RETURN 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM collection_matches
    WHERE collection_id = p_collection_id AND match_id = p_match_id AND approval_status = 'approved'
  ) THEN
    RETURN 0;
  END IF;

  UPDATE match_participants mp
  SET participant_status = 'confirmed', confirmed_at = NOW()
  FROM decks d
  WHERE mp.match_id = p_match_id
    AND mp.user_id IS NOT NULL
    AND mp.confirmed_at IS NULL
    AND d.id = mp.deck_id
    AND d.deck_name IS DISTINCT FROM 'Unknown Deck'
    AND EXISTS (
      SELECT 1 FROM collection_members cm
      WHERE cm.collection_id = p_collection_id AND cm.user_id = mp.user_id
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE matches SET is_dirty = TRUE WHERE id = p_match_id;
  END IF;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION enforce_confirmation_requires_deck()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND NEW.confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.confirmed_at IS NULL)
     AND NOT EXISTS (
       SELECT 1 FROM decks d
       WHERE d.id = NEW.deck_id AND d.deck_name IS DISTINCT FROM 'Unknown Deck'
     ) THEN
    RAISE EXCEPTION 'confirmation requires a deck: pick your deck before confirming'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_confirmation_requires_deck ON match_participants;
CREATE TRIGGER trg_confirmation_requires_deck
  BEFORE INSERT OR UPDATE OF confirmed_at ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION enforce_confirmation_requires_deck();

REVOKE ALL ON FUNCTION mark_collection_matches_dirty(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_collection_matches_dirty(UUID, UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION auto_confirm_collection_members(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_confirm_collection_members(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION enforce_confirmation_requires_deck() FROM PUBLIC, anon, authenticated;
