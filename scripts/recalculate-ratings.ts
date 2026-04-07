/**
 * Rating Recalculation Script
 *
 * Replays all confirmed matches in chronological order to rebuild rating data
 * from scratch. Safe to run multiple times — it always resets first.
 *
 * What it does:
 *   1. Calls reset_ratings_for_recalculation() RPC to wipe history and reset ratings
 *   2. Pre-loads all collection_members (collectionId → Set<userId>)
 *   3. Fetches every match with confirmed participants ordered by played_at ASC,
 *      including which collections each match belongs to (approval_status = approved)
 *   4. For each match, calculates and applies deltas for:
 *      a. Global scope — every confirmed participant
 *      b. Collection scope — confirmed participants who are also members of that collection
 *      Uses snapshotted pre-match ratings for both, matching the live algorithm
 *   5. Calls apply_rating_change() RPC per participant/scope — same SECURITY DEFINER
 *      function used by live match confirmation, so logic is identical
 *
 * Run with:
 *   npm run ratings:recalculate
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * All writes go through SECURITY DEFINER RPCs (migrations 006 + 007) which bypass
 * the system-managed-only RLS on ratings and rating_history.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database.types'
import { calculateRating, ALGORITHM_VERSION } from '../src/lib/rating'
import type { Bracket } from '../src/types/common'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '\nMissing environment variables. Ensure .env.local contains:\n' +
    '  NEXT_PUBLIC_SUPABASE_URL=<your project URL>\n' +
    '  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your publishable key>\n'
  )
  process.exit(1)
}

// RPC shims for functions not yet in the generated database.types.ts.
// Regenerate types with `supabase gen types typescript` after deploying
// migrations 006 and 007 to remove these.
type RpcClient = {
  rpc(fn: 'reset_ratings_for_recalculation', args: { confirm_reset: true }): Promise<{ error: { message: string } | null }>
  rpc(fn: 'apply_rating_change', args: {
    p_user_id: string
    p_match_id: string
    p_format_id: string
    p_collection_id: string | null
    p_new_rating: number
    p_delta: number
    p_is_win: boolean
    p_player_bracket: number
    p_opponent_avg_rating: number
    p_opponent_avg_bracket: number
    p_k_factor: number
    p_algorithm_version: number
  }): Promise<{ error: { message: string } | null }>
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const rpc = supabase as unknown as RpcClient

const DEFAULT_RATING = 1000
const DEFAULT_BRACKET: Bracket = 2

// In-memory ratings state — tracks current values as we replay matches in order.
// Used for snapshotting opponent ratings before applying each match's deltas.
// Global ratings: keyed "userId::formatId"
// Collection ratings: keyed "collectionId::userId::formatId"
type RatingEntry = { rating: number; matchesPlayed: number; wins: number }
const globalRatings = new Map<string, RatingEntry>()
const collectionRatings = new Map<string, RatingEntry>()

function ratingKey(userId: string, formatId: string): string {
  return `${userId}::${formatId}`
}

function collectionRatingKey(collectionId: string, userId: string, formatId: string): string {
  return `${collectionId}::${userId}::${formatId}`
}

function getMemRating(userId: string, formatId: string): RatingEntry {
  return (
    globalRatings.get(ratingKey(userId, formatId)) ?? {
      rating: DEFAULT_RATING,
      matchesPlayed: 0,
      wins: 0,
    }
  )
}

function getMemCollectionRating(collectionId: string, userId: string, formatId: string): RatingEntry {
  return (
    collectionRatings.get(collectionRatingKey(collectionId, userId, formatId)) ?? {
      rating: DEFAULT_RATING,
      matchesPlayed: 0,
      wins: 0,
    }
  )
}

function setMemRating(userId: string, formatId: string, entry: RatingEntry): void {
  globalRatings.set(ratingKey(userId, formatId), entry)
}

function setMemCollectionRating(collectionId: string, userId: string, formatId: string, entry: RatingEntry): void {
  collectionRatings.set(collectionRatingKey(collectionId, userId, formatId), entry)
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('=== MTG Rating Recalculation ===\n')

  // ----------------------------------------
  // Step 1: Reset via SECURITY DEFINER RPC
  // ----------------------------------------
  console.log('Step 1/3 — Resetting all ratings and clearing history...')
  const { error: resetError } = await rpc.rpc('reset_ratings_for_recalculation', { confirm_reset: true })

  if (resetError) {
    console.error('Failed to reset ratings:', resetError.message)
    console.error('\nMake sure migration 007_rating_recalc_functions.sql has been deployed:')
    console.error('  npx supabase db push\n')
    process.exit(1)
  }
  console.log('  Done.\n')

  // ----------------------------------------
  // Step 2: Pre-load collection memberships
  // ----------------------------------------
  console.log('Step 2/3 — Loading collection memberships...')

  const { data: memberships, error: membershipsError } = await supabase
    .from('collection_members')
    .select('collection_id, user_id')

  if (membershipsError) {
    console.error('Failed to load collection_members:', membershipsError.message)
    process.exit(1)
  }

  // Map of collectionId → Set<userId> for O(1) membership checks during replay
  const membersByCollection = new Map<string, Set<string>>()
  for (const m of memberships ?? []) {
    if (!membersByCollection.has(m.collection_id)) {
      membersByCollection.set(m.collection_id, new Set())
    }
    membersByCollection.get(m.collection_id)!.add(m.user_id)
  }
  console.log(`  ${membersByCollection.size} collections with members\n`)

  // ----------------------------------------
  // Step 3: Load confirmed matches
  // ----------------------------------------
  console.log('Step 3/4 — Loading confirmed matches...')

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      id,
      format_id,
      played_at,
      match_participants (
        id,
        user_id,
        is_winner,
        confirmed_at,
        deck:decks!match_participants_deck_id_fkey (
          bracket
        )
      ),
      collection_matches (
        collection_id,
        approval_status
      )
    `)
    .order('played_at', { ascending: true })

  if (matchesError) {
    console.error('Failed to load matches:', matchesError.message)
    process.exit(1)
  }

  if (!matches || matches.length === 0) {
    console.log('\nNo matches found. Nothing to calculate.')
    process.exit(0)
  }

  const replayableMatches = matches.filter((m) =>
    m.match_participants.some((p) => p.user_id && p.confirmed_at)
  )

  console.log(`  ${matches.length} total matches, ${replayableMatches.length} with confirmed participants\n`)

  // ----------------------------------------
  // Step 4: Replay — calculate + apply via RPC
  // ----------------------------------------
  console.log('Step 4/4 — Replaying matches...\n')

  let processedMatches = 0
  let processedParticipants = 0
  let processedCollectionEntries = 0
  let errors = 0

  for (const match of replayableMatches) {
    const allRealParticipants = match.match_participants.filter((p) => p.user_id)
    const confirmedParticipants = allRealParticipants.filter((p) => p.confirmed_at)

    if (confirmedParticipants.length === 0) continue

    // Snapshot everyone's in-memory rating BEFORE applying this match.
    // Unconfirmed real participants are included as opponents only.
    const snapshots = allRealParticipants.map((p) => ({
      participantId: p.id,
      userId: p.user_id!,
      bracket: (p.deck?.bracket ?? DEFAULT_BRACKET) as Bracket,
      isWinner: p.is_winner,
      confirmed: !!p.confirmed_at,
      ...getMemRating(p.user_id!, match.format_id),
    }))

    // Calculate and apply each confirmed participant's delta
    for (const participant of snapshots.filter((p) => p.confirmed)) {
      const opponents = snapshots
        .filter((p) => p.participantId !== participant.participantId)
        .map((p) => ({ rating: p.rating, bracket: p.bracket }))

      const result = calculateRating({
        playerId: participant.userId,
        playerRating: participant.rating,
        playerBracket: participant.bracket,
        playerMatchCount: participant.matchesPlayed,
        isWinner: participant.isWinner,
        opponents,
        formatId: match.format_id,
        collectionId: null,
      })

      const newRating = participant.rating + result.delta

      // Write via SECURITY DEFINER RPC (bypasses RLS on ratings + rating_history)
      const { error } = await rpc.rpc('apply_rating_change', {
        p_user_id: participant.userId,
        p_match_id: match.id,
        p_format_id: match.format_id,
        p_collection_id: null,
        p_new_rating: newRating,
        p_delta: result.delta,
        p_is_win: participant.isWinner,
        p_player_bracket: participant.bracket,
        p_opponent_avg_rating: result.opponentAvgRating,
        p_opponent_avg_bracket: result.opponentAvgBracket,
        p_k_factor: result.kFactor,
        p_algorithm_version: ALGORITHM_VERSION,
      })

      if (error) {
        console.error(`\n  apply_rating_change failed for participant ${participant.userId} in match ${match.id}: ${error.message}`)
        errors++
        continue
      }

      // Keep in-memory state in sync so subsequent matches see correct ratings
      setMemRating(participant.userId, match.format_id, {
        rating: newRating,
        matchesPlayed: participant.matchesPlayed + 1,
        wins: participant.wins + (participant.isWinner ? 1 : 0),
      })

      processedParticipants++

      // ---- Collection-scoped ratings ----
      // For each approved collection this match belongs to, apply a separate
      // rating entry if this participant is a member of that collection.
      const approvedCollections = (match.collection_matches ?? [])
        .filter((cm) => cm.approval_status === 'approved')
        .map((cm) => cm.collection_id)

      for (const collectionId of approvedCollections) {
        const members = membersByCollection.get(collectionId)
        if (!members?.has(participant.userId)) continue

        const collRating = getMemCollectionRating(collectionId, participant.userId, match.format_id)

        // Use collection-scoped opponent ratings for the calculation
        const collOpponents = snapshots
          .filter((p) => p.participantId !== participant.participantId && members.has(p.userId))
          .map((p) => ({
            rating: getMemCollectionRating(collectionId, p.userId, match.format_id).rating,
            bracket: p.bracket,
          }))

        // Fall back to global opponents if no other members are in this match
        const effectiveOpponents = collOpponents.length > 0 ? collOpponents : opponents

        const collResult = calculateRating({
          playerId: participant.userId,
          playerRating: collRating.rating,
          playerBracket: participant.bracket,
          playerMatchCount: collRating.matchesPlayed,
          isWinner: participant.isWinner,
          opponents: effectiveOpponents,
          formatId: match.format_id,
          collectionId,
        })

        const newCollRating = collRating.rating + collResult.delta

        const { error: collError } = await rpc.rpc('apply_rating_change', {
          p_user_id: participant.userId,
          p_match_id: match.id,
          p_format_id: match.format_id,
          p_collection_id: collectionId,
          p_new_rating: newCollRating,
          p_delta: collResult.delta,
          p_is_win: participant.isWinner,
          p_player_bracket: participant.bracket,
          p_opponent_avg_rating: collResult.opponentAvgRating,
          p_opponent_avg_bracket: collResult.opponentAvgBracket,
          p_k_factor: collResult.kFactor,
          p_algorithm_version: ALGORITHM_VERSION,
        })

        if (collError) {
          console.error(`\n  apply_rating_change (collection ${collectionId}) failed for ${participant.userId}: ${collError.message}`)
          errors++
          continue
        }

        setMemCollectionRating(collectionId, participant.userId, match.format_id, {
          rating: newCollRating,
          matchesPlayed: collRating.matchesPlayed + 1,
          wins: collRating.wins + (participant.isWinner ? 1 : 0),
        })
        processedCollectionEntries++
      }
    } // end for participant

    processedMatches++

    if (processedMatches % 5 === 0 || processedMatches === replayableMatches.length) {
      process.stdout.write(
        `\r  ${processedMatches}/${replayableMatches.length} matches, ${processedParticipants} participants updated`
      )
    }
  }

  console.log('\n')

  // ----------------------------------------
  // Summary
  // ----------------------------------------
  console.log('=== Done ===')
  console.log(`  Matches replayed:          ${processedMatches}`)
  console.log(`  Global history entries:    ${processedParticipants}`)
  console.log(`  Collection history entries:${processedCollectionEntries}`)
  console.log(`  Errors:                    ${errors}`)
  if (errors > 0) {
    console.log('\n  Some updates failed — check output above for details.')
    console.log('  Make sure migrations 006 and 007 are deployed: npx supabase db push')
  }
  console.log()
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
