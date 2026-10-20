\set ON_ERROR_STOP on
BEGIN;
SELECT id AS uid FROM profiles ORDER BY created_at LIMIT 1 \gset
INSERT INTO notifications (id, recipient_id, type, entity_type, entity_id, data) VALUES
  ('00000000-0000-0000-0000-0000000000a1', :'uid', 'friend_accepted', 'player', :'uid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', :'uid', 'friend_accepted', 'player', :'uid', '{}');
SELECT set_config('request.jwt.claims', json_build_object('sub', :'uid', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'marked=' || mark_notifications_seen(:'uid', ARRAY['00000000-0000-0000-0000-0000000000a1']::uuid[]);
RESET ROLE;
SELECT id, seen_at IS NOT NULL AS seen FROM notifications
 WHERE id IN ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2') ORDER BY id;
SELECT 'anon=' || has_function_privilege('anon', 'mark_notifications_seen(uuid, uuid[])', 'EXECUTE')
    || ' authenticated=' || has_function_privilege('authenticated', 'mark_notifications_seen(uuid, uuid[])', 'EXECUTE');
ROLLBACK;
