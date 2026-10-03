\set ON_ERROR_STOP on
BEGIN;
SELECT mp.user_id AS uid, m.id AS mid, m.format_id AS fid
  FROM match_participants mp JOIN matches m ON m.id = mp.match_id
 WHERE mp.user_id IS NOT NULL LIMIT 1 \gset
UPDATE matches SET is_dirty = TRUE, ratings_applied_at = NULL WHERE id = :'mid';
SELECT COUNT(*) AS conf FROM match_participants WHERE confirmed_at IS NOT NULL \gset
SELECT :conf + 1 AS wrong_conf \gset

-- Fingerprint of everything the swap touches.
CREATE TEMP VIEW fp AS SELECT md5(
     coalesce((SELECT string_agg(r::text, ',' ORDER BY r.id) FROM ratings r), '')
  || coalesce((SELECT string_agg(h::text, ',' ORDER BY h.id) FROM rating_history h), '')
  || coalesce((SELECT string_agg(m.id || ':' || m.is_dirty || ':' || coalesce(m.ratings_applied_at::text, ''), ',' ORDER BY m.id) FROM matches m), '')
  || (SELECT COUNT(*) FROM recalculation_log)::text) AS v;

-- Calls apply_rating_replay, catching the error so the transaction survives;
-- the exception block's subtransaction rolls back anything the call wrote.
CREATE FUNCTION pg_temp.try_replay(r jsonb, h jsonb, c integer) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM apply_rating_replay(r, h, ARRAY[]::uuid[], c, 'check-030-fail');
  RETURN 'NO ERROR';
EXCEPTION WHEN OTHERS THEN
  RETURN 'raised: ' || SQLERRM;
END $$;

SELECT v AS fp0 FROM fp \gset

-- (2) wrong p_expected_confirmed
SELECT 'wrong_confirmed ' || pg_temp.try_replay('[]'::jsonb, '[]'::jsonb, :wrong_conf);
SELECT 'wrong_confirmed_unchanged=' || (v = :'fp0') FROM fp;

-- (3) ratings disagree with history (1234 vs rating_after 1200)
SELECT 'inconsistent ' || pg_temp.try_replay(
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'format_id', :'fid', 'collection_id', NULL,
    'rating', 1234, 'matches_played', 1, 'wins', 1)),
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'match_id', :'mid', 'format_id', :'fid', 'collection_id', NULL,
    'rating_before', 1000, 'rating_after', 1200, 'delta', 200, 'is_win', true, 'player_bracket', 2,
    'opponent_avg_rating', 1000, 'opponent_avg_bracket', 2, 'k_factor', 32, 'algorithm_version', 1)),
  :conf);
SELECT 'inconsistent_unchanged=' || (v = :'fp0') FROM fp;

-- (4) non-array p_ratings
SELECT 'non_array ' || pg_temp.try_replay('{}'::jsonb, '[]'::jsonb, :conf);
SELECT 'non_array_unchanged=' || (v = :'fp0') FROM fp;

-- Happy path
SELECT 'written=' || apply_rating_replay(
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'format_id', :'fid', 'collection_id', NULL,
    'rating', 1234, 'matches_played', 1, 'wins', 1)),
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'match_id', :'mid', 'format_id', :'fid', 'collection_id', NULL,
    'rating_before', 1000, 'rating_after', 1234, 'delta', 234, 'is_win', true, 'player_bracket', 2,
    'opponent_avg_rating', 1000, 'opponent_avg_bracket', 2, 'k_factor', 32, 'algorithm_version', 1)),
  ARRAY[:'mid']::uuid[],
  :conf,
  'check-030'
);
SELECT 'history_total=' || count(*) FROM rating_history;
SELECT 'rating=' || rating || ' played=' || matches_played FROM ratings
 WHERE user_id = :'uid' AND format_id = :'fid' AND collection_id IS NULL;
SELECT 'dirty=' || is_dirty || ' applied=' || (ratings_applied_at IS NOT NULL) FROM matches WHERE id = :'mid';
-- (1) history is dated by the match's played_at
SELECT 'created_at_is_played_at=' || (rh.created_at = m.played_at)
  FROM rating_history rh JOIN matches m ON m.id = rh.match_id;
SELECT 'auth=' || has_function_privilege('authenticated', 'apply_rating_replay(jsonb, jsonb, uuid[], integer, text)', 'EXECUTE')
    || ' anon=' || has_function_privilege('anon', 'apply_rating_replay(jsonb, jsonb, uuid[], integer, text)', 'EXECUTE')
    || ' service=' || has_function_privilege('service_role', 'apply_rating_replay(jsonb, jsonb, uuid[], integer, text)', 'EXECUTE');
-- (5) same-millisecond pair: two matches whose played_at differ only in µs,
-- payload order OPPOSITE to µs order. The replay (Date.parse, ms + id) puts
-- mid_a first, so the ratings row equals mid_b's rating_after. created_at
-- would make mid_a's row "latest" (T+5µs vs T+1µs); the check must use
-- payload order instead and accept this.
SELECT id AS mid_a FROM matches WHERE id <> :'mid' ORDER BY id LIMIT 1 \gset
SELECT id AS mid_b FROM matches WHERE id NOT IN (:'mid', :'mid_a') ORDER BY id LIMIT 1 \gset
UPDATE matches SET played_at = date_trunc('second', NOW() - INTERVAL '1 day') + INTERVAL '5 microseconds' WHERE id = :'mid_a';
UPDATE matches SET played_at = date_trunc('second', NOW() - INTERVAL '1 day') WHERE id = :'mid_b';
SELECT 'same_ms ' || pg_temp.try_replay(
  jsonb_build_array(jsonb_build_object('user_id', :'uid', 'format_id', :'fid', 'collection_id', NULL,
    'rating', 1001, 'matches_played', 2, 'wins', 1)),
  jsonb_build_array(
    jsonb_build_object('user_id', :'uid', 'match_id', :'mid_a', 'format_id', :'fid', 'collection_id', NULL,
      'rating_before', 1000, 'rating_after', 1016, 'delta', 16, 'is_win', true, 'player_bracket', 2,
      'opponent_avg_rating', 1000, 'opponent_avg_bracket', 2, 'k_factor', 32, 'algorithm_version', 1),
    jsonb_build_object('user_id', :'uid', 'match_id', :'mid_b', 'format_id', :'fid', 'collection_id', NULL,
      'rating_before', 1016, 'rating_after', 1001, 'delta', -15, 'is_win', false, 'player_bracket', 2,
      'opponent_avg_rating', 1000, 'opponent_avg_bracket', 2, 'k_factor', 32, 'algorithm_version', 1)),
  :conf);
SELECT 'same_ms_rating=' || rating || ' played=' || matches_played || ' wins=' || wins FROM ratings
 WHERE user_id = :'uid' AND format_id = :'fid' AND collection_id IS NULL;
SELECT 'same_ms_history=' || count(*) FROM rating_history;
SELECT 'overloads=' || count(*) FROM pg_proc WHERE proname = 'apply_rating_replay';
SELECT 'procedure_exists=' || EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalculate_dirty_matches');
SELECT 'cron_job_exists=' || EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-rating-recalc');
ROLLBACK;
