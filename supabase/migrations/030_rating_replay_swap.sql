-- ============================================
-- Nightly recalc: atomic replay swap; retire the SQL procedure
-- ============================================
--
-- recalculate_dirty_matches() (018) never succeeded in production: it calls
-- upsert_rating_history(user, format, collection, match, ...) against the
-- (user, match, format, collection, ...) signature from 012. All four are
-- UUIDs, so values land in the wrong columns and global rows violate
-- rating_history.format_id NOT NULL. It also replays each user against
-- opponents' *current* ratings, so results depended on processing order.
--
-- The canonical computation now lives in TypeScript (src/lib/rating-replay.ts),
-- run nightly by .github/workflows/nightly-rating-recalc.yml. This function
-- swaps its output in atomically: either every rating and history row is
-- replaced, or (on any error) nothing changes.
--
-- Service-role only. The jsonb keys mirror the table columns. p_history must
-- be in chronological order (the replay emits it that way); its position is
-- the created_at tiebreak within a match.
--
-- Fails closed: non-array payloads, a confirmation count that moved since the
-- replay's snapshot (p_expected_confirmed), or ratings that disagree with the
-- history written alongside them all raise, rolling back the whole swap.

-- An earlier draft of this migration had no p_expected_confirmed; drop it so
-- a DB that applied that draft keeps no overload.
DROP FUNCTION IF EXISTS apply_rating_replay(JSONB, JSONB, UUID[], TEXT);

CREATE OR REPLACE FUNCTION apply_rating_replay(
  p_ratings JSONB,
  p_history JSONB,
  p_clear_dirty_match_ids UUID[],
  p_expected_confirmed INTEGER,
  p_triggered_by TEXT DEFAULT 'manual'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_history_count INTEGER;
  v_log_id UUID;
  v_confirmed INTEGER;
  v_bad INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'not authorized: rating replay is a maintenance operation';
  END IF;

  -- Block concurrent rating writes (e.g. a self-confirm) until we commit.
  LOCK TABLE ratings, rating_history IN SHARE ROW EXCLUSIVE MODE;

  IF jsonb_typeof(p_ratings) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_history) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'apply_rating_replay: p_ratings and p_history must be JSON arrays';
  END IF;

  SELECT COUNT(*) INTO v_confirmed
  FROM match_participants WHERE confirmed_at IS NOT NULL;
  IF v_confirmed IS DISTINCT FROM p_expected_confirmed THEN
    RAISE EXCEPTION 'confirmations changed since the replay snapshot (expected %, found %); re-run',
      p_expected_confirmed, v_confirmed;
  END IF;

  INSERT INTO recalculation_log (batch_size, triggered_by)
  VALUES (jsonb_array_length(p_history), p_triggered_by)
  RETURNING id INTO v_log_id;

  DELETE FROM rating_history WHERE TRUE;
  UPDATE ratings
  SET rating = 1000, matches_played = 0, wins = 0, updated_at = NOW()
  WHERE TRUE;

  UPDATE ratings r
  SET rating = x.rating, matches_played = x.matches_played, wins = x.wins, updated_at = NOW()
  FROM jsonb_to_recordset(p_ratings) AS x(
    user_id UUID, format_id UUID, collection_id UUID,
    rating INTEGER, matches_played INTEGER, wins INTEGER
  )
  WHERE r.user_id = x.user_id
    AND r.format_id = x.format_id
    AND r.collection_id IS NOT DISTINCT FROM x.collection_id;

  INSERT INTO ratings (user_id, format_id, collection_id, rating, matches_played, wins)
  SELECT x.user_id, x.format_id, x.collection_id, x.rating, x.matches_played, x.wins
  FROM jsonb_to_recordset(p_ratings) AS x(
    user_id UUID, format_id UUID, collection_id UUID,
    rating INTEGER, matches_played INTEGER, wins INTEGER
  )
  WHERE NOT EXISTS (
    SELECT 1 FROM ratings r
    WHERE r.user_id = x.user_id
      AND r.format_id = x.format_id
      AND r.collection_id IS NOT DISTINCT FROM x.collection_id
  );

  INSERT INTO rating_history (
    user_id, match_id, format_id, collection_id, rating_before, rating_after,
    delta, is_win, player_bracket, opponent_avg_rating, opponent_avg_bracket,
    k_factor, algorithm_version, created_at, recalculated_at
  )
  SELECT
    x.user_id, x.match_id, x.format_id, x.collection_id, x.rating_before, x.rating_after,
    x.delta, x.is_win, x.player_bracket, x.opponent_avg_rating, x.opponent_avg_bracket,
    x.k_factor, x.algorithm_version,
    -- History is dated by when the match was played, not when we rebuilt it;
    -- payload position breaks ties so each row keeps a stable order.
    m.played_at + (e.ord - 1) * INTERVAL '1 microsecond',
    NOW()
  FROM jsonb_array_elements(p_history) WITH ORDINALITY AS e(elem, ord)
  CROSS JOIN LATERAL jsonb_to_record(e.elem) AS x(
    user_id UUID, match_id UUID, format_id UUID, collection_id UUID,
    rating_before INTEGER, rating_after INTEGER, delta INTEGER, is_win BOOLEAN,
    player_bracket SMALLINT, opponent_avg_rating NUMERIC, opponent_avg_bracket NUMERIC,
    k_factor SMALLINT, algorithm_version SMALLINT
  )
  JOIN matches m ON m.id = x.match_id;
  GET DIAGNOSTICS v_history_count = ROW_COUNT;

  -- The inner join would silently drop rows for unknown matches.
  IF v_history_count <> jsonb_array_length(p_history) THEN
    RAISE EXCEPTION 'apply_rating_replay: % of % history rows reference no match',
      jsonb_array_length(p_history) - v_history_count, jsonb_array_length(p_history);
  END IF;

  -- Every ratings row must agree with the history written for its scope:
  -- matches played, wins, and the latest rating_after. A row with games but
  -- no history is equally wrong.
  WITH h AS (
    SELECT user_id, format_id, collection_id,
           COUNT(*) AS n,
           COUNT(*) FILTER (WHERE is_win) AS w,
           (ARRAY_AGG(rating_after ORDER BY created_at DESC))[1] AS last_rating
    FROM rating_history
    GROUP BY user_id, format_id, collection_id
  )
  SELECT COUNT(*) INTO v_bad
  FROM ratings r
  LEFT JOIN h ON h.user_id = r.user_id
             AND h.format_id = r.format_id
             AND h.collection_id IS NOT DISTINCT FROM r.collection_id
  WHERE (h.user_id IS NULL AND r.matches_played > 0)
     OR (h.user_id IS NOT NULL AND (
           r.matches_played <> h.n OR r.wins <> h.w OR r.rating <> h.last_rating));

  -- ...and every history scope must have a ratings row.
  SELECT v_bad + COUNT(*) INTO v_bad
  FROM (SELECT DISTINCT user_id, format_id, collection_id FROM rating_history) h
  WHERE NOT EXISTS (
    SELECT 1 FROM ratings r
    WHERE r.user_id = h.user_id
      AND r.format_id = h.format_id
      AND r.collection_id IS NOT DISTINCT FROM h.collection_id
  );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'apply_rating_replay: % ratings rows disagree with their history', v_bad;
  END IF;

  -- Matches confirmed only via collection auto-confirm never had ratings
  -- applied by the app; mark them applied now that they have history, so
  -- later deck edits flag them dirty (mark_match_dirty requires this).
  UPDATE matches m
  SET ratings_applied_at = COALESCE(m.ratings_applied_at, NOW())
  WHERE m.ratings_applied_at IS NULL
    AND EXISTS (SELECT 1 FROM rating_history rh WHERE rh.match_id = m.id);

  UPDATE matches SET is_dirty = FALSE WHERE id = ANY(p_clear_dirty_match_ids);

  UPDATE recalculation_log
  SET completed_at = clock_timestamp(),
      matches_processed = (SELECT COUNT(DISTINCT match_id) FROM rating_history)
  WHERE id = v_log_id;

  RETURN v_history_count;
END;
$function$;

REVOKE ALL ON FUNCTION apply_rating_replay(JSONB, JSONB, UUID[], INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_rating_replay(JSONB, JSONB, UUID[], INTEGER, TEXT) TO service_role;

-- Retire the broken SQL recalc and its schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nightly-rating-recalc') THEN
      PERFORM cron.unschedule('nightly-rating-recalc');
    END IF;
  END IF;
END $$;

DROP PROCEDURE IF EXISTS recalculate_dirty_matches(INTEGER);
