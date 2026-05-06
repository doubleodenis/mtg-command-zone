-- ============================================
-- Nightly Rating Recalculation Stored Procedure
-- ============================================
--
-- Pure PL/pgSQL implementation that runs entirely inside Postgres.
-- Called by pg_cron — no edge function or HTTP call needed.
--
-- Algorithm per-player:
--   1. Find all users affected by dirty matches
--   2. For each user: reset rating to 1000, delete rating_history
--   3. Replay all their confirmed matches in chronological order
--   4. Clear is_dirty flag on processed matches
--
-- The rating calculation matches src/lib/rating.ts exactly:
--   Delta = K × (Actual - Expected) × BracketModifier

-- ============================================
-- Algorithm Constants (matching RATING_CONFIG)
-- ============================================

-- K factor thresholds: matches 0-20 → K=32, 21-50 → K=24, 51+ → K=16
-- Bracket modifier: coefficient=0.12, exponent=1.5
-- Default rating: 1000, default bracket: 2

-- ============================================
-- Helper: Get K Factor
-- ============================================
CREATE OR REPLACE FUNCTION get_k_factor(p_matches_played INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_matches_played <= 20 THEN
    RETURN 32;
  ELSIF p_matches_played <= 50 THEN
    RETURN 24;
  ELSE
    RETURN 16;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Helper: Calculate Expected Score (ELO logistic curve)
-- ============================================
-- Expected = player_factor / sum(all_factors)
-- where factor = 10^(rating / 400)
CREATE OR REPLACE FUNCTION calculate_expected_score(
  p_player_rating INTEGER,
  p_all_ratings INTEGER[]
)
RETURNS NUMERIC AS $$
DECLARE
  v_player_factor NUMERIC;
  v_total_factor NUMERIC := 0;
  v_rating INTEGER;
BEGIN
  v_player_factor := POWER(10, p_player_rating / 400.0);
  
  FOREACH v_rating IN ARRAY p_all_ratings LOOP
    v_total_factor := v_total_factor + POWER(10, v_rating / 400.0);
  END LOOP;
  
  IF v_total_factor = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_player_factor / v_total_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Helper: Calculate Bracket Modifier
-- ============================================
-- gap = opponent_avg_bracket - player_bracket
-- modifier = 1 + sign(gap) × |gap|^1.5 × 0.12
CREATE OR REPLACE FUNCTION calculate_bracket_modifier(
  p_player_bracket SMALLINT,
  p_opponent_avg_bracket NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_gap NUMERIC;
  v_sign INTEGER;
  v_coefficient NUMERIC := 0.12;
  v_exponent NUMERIC := 1.5;
BEGIN
  v_gap := p_opponent_avg_bracket - p_player_bracket;
  
  IF v_gap >= 0 THEN
    v_sign := 1;
  ELSE
    v_sign := -1;
  END IF;
  
  RETURN 1 + v_sign * POWER(ABS(v_gap), v_exponent) * v_coefficient;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Helper: Calculate Rating Delta for One Player
-- ============================================
-- Returns the rating change (delta) for a player in a match
CREATE OR REPLACE FUNCTION calculate_rating_delta(
  p_player_rating INTEGER,
  p_player_bracket SMALLINT,
  p_player_match_count INTEGER,
  p_is_winner BOOLEAN,
  p_opponent_ratings INTEGER[],
  p_opponent_brackets SMALLINT[]
)
RETURNS TABLE (
  delta INTEGER,
  expected_score NUMERIC,
  k_factor INTEGER,
  bracket_modifier NUMERIC,
  opponent_avg_rating NUMERIC,
  opponent_avg_bracket NUMERIC
) AS $$
DECLARE
  v_actual_score INTEGER;
  v_all_ratings INTEGER[];
  v_expected NUMERIC;
  v_k INTEGER;
  v_opp_avg_rating NUMERIC;
  v_opp_avg_bracket NUMERIC;
  v_bracket_mod NUMERIC;
  v_raw_delta NUMERIC;
  v_delta INTEGER;
BEGIN
  -- Actual score: 1 for win, 0 for loss
  v_actual_score := CASE WHEN p_is_winner THEN 1 ELSE 0 END;
  
  -- All ratings including player
  v_all_ratings := p_player_rating || p_opponent_ratings;
  
  -- Expected score
  v_expected := calculate_expected_score(p_player_rating, v_all_ratings);
  
  -- K factor based on experience
  v_k := get_k_factor(p_player_match_count);
  
  -- Opponent averages
  IF array_length(p_opponent_ratings, 1) > 0 THEN
    SELECT AVG(r)::NUMERIC INTO v_opp_avg_rating FROM unnest(p_opponent_ratings) r;
    SELECT AVG(b)::NUMERIC INTO v_opp_avg_bracket FROM unnest(p_opponent_brackets) b;
  ELSE
    v_opp_avg_rating := 1000;
    v_opp_avg_bracket := 2;
  END IF;
  
  -- Bracket modifier
  v_bracket_mod := calculate_bracket_modifier(p_player_bracket, v_opp_avg_bracket);
  
  -- Final delta: K × (actual - expected) × bracket_modifier
  v_raw_delta := v_k * (v_actual_score - v_expected) * v_bracket_mod;
  v_delta := ROUND(v_raw_delta)::INTEGER;
  
  RETURN QUERY SELECT 
    v_delta,
    v_expected,
    v_k,
    v_bracket_mod,
    v_opp_avg_rating,
    v_opp_avg_bracket;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Main Recalculation Procedure
-- ============================================
CREATE OR REPLACE PROCEDURE recalculate_dirty_matches(
  p_batch_size INTEGER DEFAULT 100
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
  v_dirty_match RECORD;
  v_affected_user_id UUID;
  v_affected_users UUID[];
  v_match RECORD;
  v_participant RECORD;
  v_opponent RECORD;
  v_opponent_ratings INTEGER[];
  v_opponent_brackets SMALLINT[];
  v_current_rating INTEGER;
  v_current_matches INTEGER;
  v_calc RECORD;
  v_collection_id UUID;
  v_matches_processed INTEGER := 0;
  v_matches_failed INTEGER := 0;
BEGIN
  -- Start log entry
  v_log_id := start_recalculation_log(p_batch_size, 'scheduled');
  
  -- Step 1: Get dirty matches and find all affected users
  SELECT ARRAY_AGG(DISTINCT mp.user_id) INTO v_affected_users
  FROM matches m
  JOIN match_participants mp ON mp.match_id = m.id
  WHERE m.is_dirty = TRUE
    AND m.ratings_applied_at IS NOT NULL
    AND mp.user_id IS NOT NULL;
  
  IF v_affected_users IS NULL OR array_length(v_affected_users, 1) IS NULL THEN
    -- No dirty matches, complete log and exit
    PERFORM complete_recalculation_log(v_log_id, 0, 0, NULL);
    RETURN;
  END IF;
  
  -- Step 2: For each affected user, reset their ratings and replay history
  FOREACH v_affected_user_id IN ARRAY v_affected_users LOOP
    BEGIN
      -- Reset global rating to 1000
      UPDATE ratings
      SET rating = 1000, matches_played = 0, wins = 0, updated_at = NOW()
      WHERE user_id = v_affected_user_id;
      
      -- Delete all rating_history for this user
      DELETE FROM rating_history WHERE user_id = v_affected_user_id;
      
      -- Reset collection-scoped ratings too
      UPDATE ratings
      SET rating = 1000, matches_played = 0, wins = 0, updated_at = NOW()
      WHERE user_id = v_affected_user_id AND collection_id IS NOT NULL;
      
      -- Step 3: Replay all confirmed matches for this user in chronological order
      FOR v_match IN
        SELECT DISTINCT m.id, m.format_id, m.played_at
        FROM matches m
        JOIN match_participants mp ON mp.match_id = m.id
        WHERE mp.user_id = v_affected_user_id
          AND mp.confirmed_at IS NOT NULL
          AND m.ratings_applied_at IS NOT NULL
        ORDER BY m.played_at ASC
      LOOP
        -- Get this user's participant info in this match
        SELECT mp.id, mp.is_winner, COALESCE(d.bracket, 2)::SMALLINT as bracket, mp.deck_id
        INTO v_participant
        FROM match_participants mp
        LEFT JOIN decks d ON mp.deck_id = d.id
        WHERE mp.match_id = v_match.id AND mp.user_id = v_affected_user_id;
        
        -- Get opponent ratings and brackets (snapshot current state)
        SELECT 
          ARRAY_AGG(COALESCE(r.rating, 1000)),
          ARRAY_AGG(COALESCE(d.bracket, 2)::SMALLINT)
        INTO v_opponent_ratings, v_opponent_brackets
        FROM match_participants mp
        LEFT JOIN decks d ON mp.deck_id = d.id
        LEFT JOIN ratings r ON r.user_id = mp.user_id 
          AND r.format_id = v_match.format_id 
          AND r.collection_id IS NULL
        WHERE mp.match_id = v_match.id 
          AND mp.user_id IS NOT NULL
          AND mp.user_id != v_affected_user_id;
        
        -- Handle case with no opponents (placeholder-only match)
        IF v_opponent_ratings IS NULL THEN
          v_opponent_ratings := ARRAY[]::INTEGER[];
          v_opponent_brackets := ARRAY[]::SMALLINT[];
        END IF;
        
        -- Get current rating and match count
        SELECT COALESCE(rating, 1000), COALESCE(matches_played, 0)
        INTO v_current_rating, v_current_matches
        FROM ratings
        WHERE user_id = v_affected_user_id 
          AND format_id = v_match.format_id 
          AND collection_id IS NULL;
        
        IF v_current_rating IS NULL THEN
          v_current_rating := 1000;
          v_current_matches := 0;
        END IF;
        
        -- Calculate rating delta (skip if no real opponents)
        IF array_length(v_opponent_ratings, 1) > 0 THEN
          SELECT * INTO v_calc FROM calculate_rating_delta(
            v_current_rating,
            v_participant.bracket,
            v_current_matches,
            v_participant.is_winner,
            v_opponent_ratings,
            v_opponent_brackets
          );
          
          -- Apply global rating change
          PERFORM update_user_rating(
            v_affected_user_id,
            v_match.format_id,
            NULL,  -- global
            v_current_rating + v_calc.delta,
            1,  -- +1 match
            CASE WHEN v_participant.is_winner THEN 1 ELSE 0 END
          );
          
          -- Insert rating_history
          PERFORM upsert_rating_history(
            v_affected_user_id,
            v_match.format_id,
            NULL,  -- global
            v_match.id,
            v_current_rating,
            v_current_rating + v_calc.delta,
            v_calc.delta,
            v_participant.is_winner,
            v_participant.bracket,
            v_calc.opponent_avg_rating,
            v_calc.opponent_avg_bracket,
            v_calc.k_factor::SMALLINT,
            1::SMALLINT  -- algorithm version
          );
          
          -- Handle collection-scoped ratings
          FOR v_collection_id IN
            SELECT cm.collection_id
            FROM collection_matches cm
            WHERE cm.match_id = v_match.id AND cm.approval_status = 'approved'
          LOOP
            -- Get collection-scoped rating
            SELECT COALESCE(rating, 1000), COALESCE(matches_played, 0)
            INTO v_current_rating, v_current_matches
            FROM ratings
            WHERE user_id = v_affected_user_id 
              AND format_id = v_match.format_id 
              AND collection_id = v_collection_id;
            
            IF v_current_rating IS NULL THEN
              v_current_rating := 1000;
              v_current_matches := 0;
            END IF;
            
            -- Recalculate with collection-scoped opponent ratings
            SELECT 
              ARRAY_AGG(COALESCE(r.rating, 1000)),
              ARRAY_AGG(COALESCE(d.bracket, 2)::SMALLINT)
            INTO v_opponent_ratings, v_opponent_brackets
            FROM match_participants mp
            LEFT JOIN decks d ON mp.deck_id = d.id
            LEFT JOIN ratings r ON r.user_id = mp.user_id 
              AND r.format_id = v_match.format_id 
              AND r.collection_id = v_collection_id
            WHERE mp.match_id = v_match.id 
              AND mp.user_id IS NOT NULL
              AND mp.user_id != v_affected_user_id;
            
            IF v_opponent_ratings IS NOT NULL AND array_length(v_opponent_ratings, 1) > 0 THEN
              SELECT * INTO v_calc FROM calculate_rating_delta(
                v_current_rating,
                v_participant.bracket,
                v_current_matches,
                v_participant.is_winner,
                v_opponent_ratings,
                v_opponent_brackets
              );
              
              PERFORM update_user_rating(
                v_affected_user_id,
                v_match.format_id,
                v_collection_id,
                v_current_rating + v_calc.delta,
                1,
                CASE WHEN v_participant.is_winner THEN 1 ELSE 0 END
              );
              
              PERFORM upsert_rating_history(
                v_affected_user_id,
                v_match.format_id,
                v_collection_id,
                v_match.id,
                v_current_rating,
                v_current_rating + v_calc.delta,
                v_calc.delta,
                v_participant.is_winner,
                v_participant.bracket,
                v_calc.opponent_avg_rating,
                v_calc.opponent_avg_bracket,
                v_calc.k_factor::SMALLINT,
                1::SMALLINT
              );
            END IF;
          END LOOP;
        END IF;
        
        v_matches_processed := v_matches_processed + 1;
      END LOOP;
      
    EXCEPTION WHEN OTHERS THEN
      v_matches_failed := v_matches_failed + 1;
      RAISE WARNING 'Failed to recalculate for user %: %', v_affected_user_id, SQLERRM;
    END;
  END LOOP;
  
  -- Step 4: Clear dirty flags on all dirty matches
  UPDATE matches SET is_dirty = FALSE
  WHERE is_dirty = TRUE AND ratings_applied_at IS NOT NULL;
  
  -- Complete log entry
  PERFORM complete_recalculation_log(v_log_id, v_matches_processed, v_matches_failed, NULL);
  
END;
$$;

-- Grant execute to service role (pg_cron runs as service)
GRANT EXECUTE ON PROCEDURE recalculate_dirty_matches(INTEGER) TO service_role;

-- ============================================
-- pg_cron Job Setup
-- ============================================
-- Run this AFTER enabling pg_cron in Supabase Dashboard:
--   Settings → Database → Extensions → pg_cron (enable)
--
-- Then execute in SQL Editor:
--
-- SELECT cron.schedule(
--   'nightly-rating-recalc',     -- job name
--   '0 4 * * *',                  -- 4am UTC daily
--   $$CALL recalculate_dirty_matches(100)$$
-- );
--
-- To check job status:
-- SELECT * FROM cron.job;
--
-- To see job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- To unschedule:
-- SELECT cron.unschedule('nightly-rating-recalc');
