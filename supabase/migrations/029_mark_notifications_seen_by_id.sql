-- ============================================
-- mark_notifications_seen: mark only the notifications the client showed
-- ============================================
--
-- The notification dropdown called mark_notifications_seen(p_recipient_id),
-- which stamps seen_at on EVERY unseen row for the recipient -- including
-- rows the client never loaded (one inserted after the dropdown fetched its
-- list). Those rows then never badge again. Playtest 2026-09-30: a
-- collection_invite was marked seen 14s after it was created without ever
-- being displayed.
--
-- Adds p_notification_ids. DEFAULT NULL keeps the old mark-all behaviour,
-- mirroring mark_notifications_read (028). Changing the argument list needs
-- DROP + CREATE: CREATE OR REPLACE would add an overload and make
-- one-argument calls ambiguous.
--
-- Grants: a newly created function gets EXECUTE for PUBLIC (Postgres) and
-- anon (Supabase default privileges). 027's deny-by-default loop ran once,
-- so apply its outcome for this function here. 027 still allowlists the
-- name, so re-running 027 after a restore stays correct.

DROP FUNCTION IF EXISTS mark_notifications_seen(UUID);

CREATE FUNCTION mark_notifications_seen(
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

  UPDATE notifications
  SET seen_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND seen_at IS NULL
    AND dismissed_at IS NULL
    AND (p_notification_ids IS NULL OR id = ANY(p_notification_ids));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION mark_notifications_seen(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_seen(UUID, UUID[]) TO authenticated, service_role;
