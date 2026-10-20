\set ON_ERROR_STOP off
-- Expected failures below must not abort the transaction: roll back each
-- failing statement on its own (implicit per-statement savepoints).
\set ON_ERROR_ROLLBACK on
BEGIN;
-- Fixture: a collection owned by A, B a member, C not; a match in it with A, B, C.
SELECT id AS a FROM profiles ORDER BY created_at LIMIT 1 OFFSET 0 \gset
SELECT id AS b FROM profiles ORDER BY created_at LIMIT 1 OFFSET 1 \gset
SELECT id AS c FROM profiles ORDER BY created_at LIMIT 1 OFFSET 2 \gset
SELECT id AS fmt FROM formats ORDER BY name LIMIT 1 \gset
INSERT INTO collections (id, name, owner_id, auto_approve_members) VALUES ('00000000-0000-0000-0000-00000000c031', 'check-031', :'a', true);
INSERT INTO collection_members (collection_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000c031', :'a', 'owner'),
  ('00000000-0000-0000-0000-00000000c031', :'b', 'member');
INSERT INTO decks (id, owner_id, commander_name, deck_name, bracket) VALUES
  ('00000000-0000-0000-0000-00000000d0a1', :'a', 'Atraxa', 'Real A', 2),
  ('00000000-0000-0000-0000-00000000d0b1', :'b', 'Unknown', 'Unknown Deck', 2);
INSERT INTO matches (id, format_id, created_by, played_at) VALUES ('00000000-0000-0000-0000-00000000e031', :'fmt', :'a', NOW());
INSERT INTO match_participants (match_id, user_id, deck_id, is_winner) VALUES
  ('00000000-0000-0000-0000-00000000e031', :'a', '00000000-0000-0000-0000-00000000d0a1', true),
  ('00000000-0000-0000-0000-00000000e031', :'b', '00000000-0000-0000-0000-00000000d0b1', false),
  ('00000000-0000-0000-0000-00000000e031', :'c', NULL, false);
INSERT INTO collection_matches (collection_id, match_id, added_by, approval_status) VALUES
  ('00000000-0000-0000-0000-00000000c031', '00000000-0000-0000-0000-00000000e031', :'a', 'approved');

-- 1. Deck rule: B (Unknown Deck) and C (no deck) can't be confirmed; A can.
UPDATE match_participants SET confirmed_at = NOW() WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND user_id = :'b';
UPDATE match_participants SET confirmed_at = NOW() WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND user_id = :'c';

-- 2. Auto-confirm as A: confirms only A (real deck), flags the match dirty.
SELECT set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT 'auto_confirmed=' || auto_confirm_collection_members('00000000-0000-0000-0000-00000000e031', '00000000-0000-0000-0000-00000000c031');
SELECT 'flagged=' || mark_collection_matches_dirty('00000000-0000-0000-0000-00000000c031', :'a');
RESET ROLE;
SELECT 'confirmed=' || string_agg(user_id::text, ',' ORDER BY user_id) FROM match_participants
 WHERE match_id = '00000000-0000-0000-0000-00000000e031' AND confirmed_at IS NOT NULL;
SELECT 'dirty=' || is_dirty FROM matches WHERE id = '00000000-0000-0000-0000-00000000e031';

-- 3. Non-member C may not flag or auto-confirm.
SELECT set_config('request.jwt.claims', json_build_object('sub', :'c', 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT mark_collection_matches_dirty('00000000-0000-0000-0000-00000000c031');
SELECT auto_confirm_collection_members('00000000-0000-0000-0000-00000000e031', '00000000-0000-0000-0000-00000000c031');
RESET ROLE;
ROLLBACK;

-- 4. Grandfathering: an existing confirmed-on-Unknown-Deck row can be updated (deck change) without error.
BEGIN;
SELECT mp.id AS pid FROM match_participants mp WHERE mp.confirmed_at IS NOT NULL AND mp.user_id IS NOT NULL LIMIT 1 \gset
UPDATE match_participants SET confirmed_at = confirmed_at WHERE id = :'pid';
SELECT 'grandfathered_ok';
ROLLBACK;
