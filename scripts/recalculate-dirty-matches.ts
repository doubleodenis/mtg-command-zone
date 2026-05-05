/**
 * Dirty Match Rating Recalculation Script
 *
 * Processes matches flagged as "dirty" (edited after ratings were applied).
 * Unlike the full recalculation script, this only recalculates specific matches
 * without resetting all ratings.
 *
 * What happens when a match is "dirty":
 *   - A deck was changed after ratings were applied (bracket may differ)
 *   - The played_at date was changed (affects chronological ordering)
 *   - The rating delta for all participants needs to be recalculated
 *
 * Algorithm:
 *   1. Fetch all dirty matches ordered by played_at ASC
 *   2. For each dirty match:
 *      a. Get each participant's rating BEFORE this match from rating_history
 *      b. Calculate new deltas using current deck brackets
 *      c. Update rating_history rows with new values
 *      d. Update current ratings in the ratings table
 *      e. Clear the dirty flag
 *
 * Cascading: When a match is recalculated, later matches involving the same
 * players might also need updating since their "rating_before" could change.
 * For v1, we only recalculate explicitly dirty matches. Future versions may
 * implement full cascading.
 *
 * Run with:
 *   npx tsx scripts/recalculate-dirty-matches.ts
 *   -- or --
 *   npm run ratings:recalculate-dirty (add to package.json)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import { calculateRating, ALGORITHM_VERSION } from '../src/lib/rating'
import type { Bracket } from '../src/types/common'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BATCH_SIZE = parseInt(process.env.RECALC_BATCH_SIZE ?? '50', 10)

console.log(`[RATING] recalculate-dirty-matches: Script starting with batch size ${BATCH_SIZE}`);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '\nMissing environment variables. Ensure .env.local contains:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=<your project URL>\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your publishable key>\n'
  )
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// RPC shims for functions not yet in the generated database.types.ts.
// Regenerate types with `supabase gen types typescript` after deploying
// migration 017_dirty_match_recalculation.sql to remove these.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase as any

const DEFAULT_RATING = 1000

// ============================================
// Types
// ============================================

type DirtyMatch = {
  match_id: string
  format_id: string
  played_at: string
  created_by: string
}

type MatchParticipant = {
  participant_id: string
  user_id: string
  deck_id: string | null
  deck_bracket: number
  is_winner: boolean
  team: string | null
}

type RecalcResult = {
  matchId: string
  participants: number
  globalUpdates: number
  collectionUpdates: number
  error?: string
}

// ============================================
// Helper Functions
// ============================================

/**
 * Gets a user's rating before a specific match from rating_history.
 */
async function getRatingBeforeMatch(
  userId: string,
  formatId: string,
  collectionId: string | null,
  matchPlayedAt: string
): Promise<number> {
  // Use the SQL function for this
  const { data, error } = await rpc.rpc('get_rating_before_match', {
    p_user_id: userId,
    p_format_id: formatId,
    p_collection_id: collectionId,
    p_match_played_at: matchPlayedAt,
  })

  if (error) {
    console.warn(`  Warning: Could not get rating before match: ${error.message}. Using default.`)
    return DEFAULT_RATING
  }

  return data ?? DEFAULT_RATING
}

/**
 * Gets a user's current rating from the ratings table.
 */
async function getCurrentRating(
  userId: string,
  formatId: string,
  collectionId: string | null
): Promise<{ rating: number; matchesPlayed: number; wins: number }> {
  let query = supabase
    .from('ratings')
    .select('rating, matches_played, wins')
    .eq('user_id', userId)
    .eq('format_id', formatId)

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.is('collection_id', null)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return { rating: DEFAULT_RATING, matchesPlayed: 0, wins: 0 }
  }

  return {
    rating: data.rating,
    matchesPlayed: data.matches_played,
    wins: data.wins,
  }
}

/**
 * Gets the existing rating_history entry for a participant in a match.
 */
async function getExistingHistoryEntry(
  userId: string,
  matchId: string,
  formatId: string,
  collectionId: string | null
): Promise<{ ratingBefore: number; ratingAfter: number; delta: number; isWin: boolean } | null> {
  let query = supabase
    .from('rating_history')
    .select('rating_before, rating_after, delta, is_win')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .eq('format_id', formatId)

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.is('collection_id', null)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return null
  }

  return {
    ratingBefore: data.rating_before,
    ratingAfter: data.rating_after,
    delta: data.delta,
    isWin: data.is_win,
  }
}

/**
 * Recalculates ratings for a single match.
 */
async function recalculateMatch(
  match: DirtyMatch,
  membersByCollection: Map<string, Set<string>>
): Promise<RecalcResult> {
  console.log(`[RATING] recalculateMatch: Processing match ${match.match_id} (played at ${match.played_at})`);
  const result: RecalcResult = {
    matchId: match.match_id,
    participants: 0,
    globalUpdates: 0,
    collectionUpdates: 0,
  }

  try {
    // Get participants for this match
    const { data: participantsRaw, error: participantsError } = await rpc.rpc(
      'get_match_participants_for_recalc',
      { p_match_id: match.match_id }
    )

    if (participantsError) {
      result.error = `Failed to get participants: ${participantsError.message}`
      return result
    }

    const participants = (participantsRaw as MatchParticipant[]) ?? []
    result.participants = participants.length

    // Log participant details including deck brackets
    console.log(`[RATING] recalculateMatch: Found ${participants.length} participants:`);
    for (const p of participants) {
      console.log(`[RATING]   - user=${p.user_id}, deck=${p.deck_id}, bracket=${p.deck_bracket}, isWinner=${p.is_winner}`);
    }

    if (participants.length === 0) {
      console.log(`[RATING] recalculateMatch: No participants, clearing dirty flag only`);
      // No real participants, just clear the dirty flag
      await rpc.rpc('clear_match_dirty_flag', { p_match_id: match.match_id })
      return result
    }

    // Get approved collections for this match
    const { data: collectionMatches } = await supabase
      .from('collection_matches')
      .select('collection_id')
      .eq('match_id', match.match_id)
      .eq('approval_status', 'approved')

    const approvedCollectionIds = (collectionMatches ?? []).map((cm) => cm.collection_id)

    // Snapshot ratings BEFORE this match for all participants
    const snapshots = await Promise.all(
      participants.map(async (p) => {
        const ratingBefore = await getRatingBeforeMatch(
          p.user_id,
          match.format_id,
          null, // global
          match.played_at
        )
        const existingEntry = await getExistingHistoryEntry(
          p.user_id,
          match.match_id,
          match.format_id,
          null
        )
        const currentRating = await getCurrentRating(p.user_id, match.format_id, null)

        return {
          ...p,
          ratingBefore,
          existingEntry,
          currentRating,
        }
      })
    )

    // Calculate and apply new deltas for each participant (global scope)
    for (const participant of snapshots) {
      const opponents = snapshots
        .filter((p) => p.participant_id !== participant.participant_id)
        .map((p) => ({
          rating: p.ratingBefore,
          bracket: p.deck_bracket as Bracket,
        }))

      if (opponents.length === 0) continue

      const calcResult = calculateRating({
        playerId: participant.user_id,
        playerRating: participant.ratingBefore,
        playerBracket: participant.deck_bracket as Bracket,
        playerMatchCount: participant.currentRating.matchesPlayed - 1, // Pre-match count
        isWinner: participant.is_winner,
        opponents,
        formatId: match.format_id,
        collectionId: null,
      })

      const newRatingAfter = participant.ratingBefore + calcResult.delta
      const oldEntry = participant.existingEntry

      // Calculate the difference in delta (to adjust current rating)
      const oldDelta = oldEntry?.delta ?? 0
      const deltaChange = calcResult.delta - oldDelta
      
      // Detailed logging for debugging bracket recalculation
      console.log(`[RATING] recalculateMatch: === User ${participant.user_id} ===`);
      console.log(`[RATING]   Deck bracket used: ${participant.deck_bracket}`);
      console.log(`[RATING]   Opponents: ${opponents.map(o => `rating=${o.rating},bracket=${o.bracket}`).join(' | ')}`);
      console.log(`[RATING]   Calculation inputs: playerRating=${participant.ratingBefore}, playerBracket=${participant.deck_bracket}, isWinner=${participant.is_winner}`);
      console.log(`[RATING]   Calculation results: expectedScore=${calcResult.expectedScore.toFixed(4)}, kFactor=${calcResult.kFactor}, bracketModifier=${calcResult.bracketModifier.toFixed(4)}`);
      console.log(`[RATING]   Old entry: ${oldEntry ? `delta=${oldEntry.delta}, ratingBefore=${oldEntry.ratingBefore}, ratingAfter=${oldEntry.ratingAfter}` : 'NONE (new entry)'}`); 
      console.log(`[RATING]   Delta comparison: oldDelta=${oldDelta} → newDelta=${calcResult.delta} (change=${deltaChange > 0 ? '+' : ''}${deltaChange})`);
      console.log(`[RATING]   Rating: ${participant.ratingBefore} → ${newRatingAfter}`);

      // Update or insert rating_history using upsert
      const { error: upsertError } = await rpc.rpc('upsert_rating_history', {
        p_user_id: participant.user_id,
        p_match_id: match.match_id,
        p_format_id: match.format_id,
        p_collection_id: null,
        p_rating_before: participant.ratingBefore,
        p_rating_after: newRatingAfter,
        p_delta: calcResult.delta,
        p_is_win: participant.is_winner,
        p_player_bracket: participant.deck_bracket,
        p_opponent_avg_rating: calcResult.opponentAvgRating,
        p_opponent_avg_bracket: calcResult.opponentAvgBracket,
        p_k_factor: calcResult.kFactor,
        p_algorithm_version: ALGORITHM_VERSION,
      })

      if (upsertError) {
        console.error(`[RATING] recalculateMatch: FAILED upsert_rating_history for ${participant.user_id}: ${upsertError.message}`);
        continue
      }
      console.log(`[RATING]   upsert_rating_history: SUCCESS`);

      // If the delta changed, we need to adjust the current rating
      if (deltaChange !== 0) {
        const newCurrentRating = participant.currentRating.rating + deltaChange
        console.log(`[RATING]   Adjusting current rating: ${participant.currentRating.rating} + ${deltaChange} = ${newCurrentRating}`);
        const { error: updateError } = await rpc.rpc('update_user_rating', {
          p_user_id: participant.user_id,
          p_format_id: match.format_id,
          p_collection_id: null,
          p_new_rating: newCurrentRating,
          p_adjust_matches: 0, // No change to matches_played
          p_adjust_wins: 0, // No change to wins (result didn't change)
        })

        if (updateError) {
          console.error(`[RATING] recalculateMatch: FAILED update_user_rating for ${participant.user_id}: ${updateError.message}`);
        } else {
          console.log(`[RATING]   update_user_rating: SUCCESS`);
        }
      } else {
        console.log(`[RATING]   No delta change, skipping rating update`);
      }

      result.globalUpdates++
    }

    // Process collection-scoped ratings
    for (const collectionId of approvedCollectionIds) {
      const members = membersByCollection.get(collectionId)
      if (!members) continue

      const collectionParticipants = snapshots.filter((p) => members.has(p.user_id))
      if (collectionParticipants.length < 2) continue // Need at least 2 members for rating

      for (const participant of collectionParticipants) {
        // Get collection-specific rating before
        const collRatingBefore = await getRatingBeforeMatch(
          participant.user_id,
          match.format_id,
          collectionId,
          match.played_at
        )
        const collExistingEntry = await getExistingHistoryEntry(
          participant.user_id,
          match.match_id,
          match.format_id,
          collectionId
        )
        const collCurrentRating = await getCurrentRating(
          participant.user_id,
          match.format_id,
          collectionId
        )

        // Get collection-scoped opponent ratings
        const collOpponents = collectionParticipants
          .filter((p) => p.participant_id !== participant.participant_id)

        if (collOpponents.length === 0) continue

        // Get opponent ratings before match for collection scope
        const opponentsWithRatings = await Promise.all(
          collOpponents.map(async (opp) => ({
            rating: await getRatingBeforeMatch(opp.user_id, match.format_id, collectionId, match.played_at),
            bracket: opp.deck_bracket as Bracket,
          }))
        )

        const collCalcResult = calculateRating({
          playerId: participant.user_id,
          playerRating: collRatingBefore,
          playerBracket: participant.deck_bracket as Bracket,
          playerMatchCount: collCurrentRating.matchesPlayed - 1,
          isWinner: participant.is_winner,
          opponents: opponentsWithRatings,
          formatId: match.format_id,
          collectionId,
        })

        const collNewRatingAfter = collRatingBefore + collCalcResult.delta
        const collOldDelta = collExistingEntry?.delta ?? 0
        const collDeltaChange = collCalcResult.delta - collOldDelta

        // Upsert collection rating history
        const { error: collUpsertError } = await rpc.rpc('upsert_rating_history', {
          p_user_id: participant.user_id,
          p_match_id: match.match_id,
          p_format_id: match.format_id,
          p_collection_id: collectionId,
          p_rating_before: collRatingBefore,
          p_rating_after: collNewRatingAfter,
          p_delta: collCalcResult.delta,
          p_is_win: participant.is_winner,
          p_player_bracket: participant.deck_bracket,
          p_opponent_avg_rating: collCalcResult.opponentAvgRating,
          p_opponent_avg_bracket: collCalcResult.opponentAvgBracket,
          p_k_factor: collCalcResult.kFactor,
          p_algorithm_version: ALGORITHM_VERSION,
        })

        if (collUpsertError) {
          console.warn(`  Warning: Failed to upsert collection history: ${collUpsertError.message}`)
          continue
        }

        // Adjust collection rating if delta changed
        if (collDeltaChange !== 0) {
          const collNewRating = collCurrentRating.rating + collDeltaChange
          await rpc.rpc('update_user_rating', {
            p_user_id: participant.user_id,
            p_format_id: match.format_id,
            p_collection_id: collectionId,
            p_new_rating: collNewRating,
            p_adjust_matches: 0,
            p_adjust_wins: 0,
          })
        }

        result.collectionUpdates++
      }
    }

    // Clear the dirty flag
    console.log(`[RATING] recalculateMatch: Clearing dirty flag for match ${match.match_id}`);
    const { error: clearError } = await rpc.rpc('clear_match_dirty_flag', {
      p_match_id: match.match_id,
    })

    if (clearError) {
      console.error(`[RATING] recalculateMatch: FAILED to clear dirty flag: ${clearError.message}`);
      result.error = `Failed to clear dirty flag: ${clearError.message}`
    } else {
      console.log(`[RATING] recalculateMatch: SUCCESS - match ${match.match_id} recalculation complete`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[RATING] recalculateMatch: EXCEPTION for match ${match.match_id}: ${errMsg}`);
    result.error = errMsg
  }

  return result
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== Dirty Match Rating Recalculation ===\n')
  console.log(`Batch size: ${BATCH_SIZE}\n`)

  // Start logging
  const { data: logId, error: logError } = await rpc.rpc('start_recalculation_log', {
    p_batch_size: BATCH_SIZE,
    p_triggered_by: 'manual',
  })

  if (logError) {
    console.warn(`Warning: Could not create recalculation log: ${logError.message}`)
  }

  // Step 1: Load collection memberships
  console.log('Loading collection memberships...')
  const { data: memberships, error: membershipsError } = await supabase
    .from('collection_members')
    .select('collection_id, user_id')

  if (membershipsError) {
    console.error('Failed to load collection_members:', membershipsError.message)
    process.exit(1)
  }

  const membersByCollection = new Map<string, Set<string>>()
  for (const m of memberships ?? []) {
    if (!membersByCollection.has(m.collection_id)) {
      membersByCollection.set(m.collection_id, new Set())
    }
    membersByCollection.get(m.collection_id)!.add(m.user_id)
  }
  console.log(`  ${membersByCollection.size} collections with members\n`)

  // Step 2: Get dirty matches
  console.log('Fetching dirty matches...')
  const { data: dirtyMatchesRaw, error: dirtyError } = await rpc.rpc('get_dirty_matches_batch', {
    p_limit: BATCH_SIZE,
  })

  if (dirtyError) {
    console.error('Failed to get dirty matches:', dirtyError.message)
    process.exit(1)
  }

  const dirtyMatches = (dirtyMatchesRaw as DirtyMatch[]) ?? []
  console.log(`  Found ${dirtyMatches.length} dirty matches\n`)
  
  // Log each dirty match for debugging
  if (dirtyMatches.length > 0) {
    console.log('[RATING] Dirty matches to process:');
    for (const m of dirtyMatches) {
      console.log(`[RATING]   - match_id=${m.match_id}, format=${m.format_id}, played_at=${m.played_at}`);
    }
    console.log('');
  }

  if (dirtyMatches.length === 0) {
    console.log('No dirty matches to process.')
    
    if (logId) {
      await rpc.rpc('complete_recalculation_log', {
        p_log_id: logId,
        p_matches_processed: 0,
        p_matches_failed: 0,
      })
    }
    
    process.exit(0)
  }

  // Step 3: Process each dirty match
  console.log('Processing dirty matches...\n')

  let processed = 0
  let failed = 0
  const errors: string[] = []

  for (const match of dirtyMatches) {
    const result = await recalculateMatch(match, membersByCollection)

    if (result.error) {
      failed++
      errors.push(`Match ${result.matchId}: ${result.error}`)
      console.log(`  ✗ Match ${result.matchId}: ${result.error}`)
    } else {
      processed++
      console.log(
        `  ✓ Match ${result.matchId}: ${result.globalUpdates} global, ` +
        `${result.collectionUpdates} collection updates`
      )
    }
  }

  // Step 4: Complete logging
  console.log('\n--- Summary ---')
  console.log(`Processed: ${processed}`)
  console.log(`Failed: ${failed}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach((e) => console.log(`  - ${e}`))
  }

  if (logId) {
    await rpc.rpc('complete_recalculation_log', {
      p_log_id: logId,
      p_matches_processed: processed,
      p_matches_failed: failed,
      p_error_message: errors.length > 0 ? errors.join('; ') : null,
    })
  }

  // Check if there are more dirty matches (for continuation)
  const { data: remaining } = await rpc.rpc('get_dirty_matches_batch', { p_limit: 1 })
  const remainingCount = (remaining as DirtyMatch[])?.length ?? 0

  if (remainingCount > 0) {
    console.log(`\n⚠ More dirty matches remain. Run again to continue.`)
  } else {
    console.log(`\n✓ All dirty matches processed.`)
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
