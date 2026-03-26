/**
 * Stats Service
 *
 * Business logic for platform-wide and user statistics.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'

// ============================================
// Types
// ============================================

export type PlatformStats = {
  totalMatches: number
  totalPlayers: number
  totalDecks: number
  totalCollections: number
}

export type UserStats = {
  matchesPlayed: number
  wins: number
  losses: number
  winRate: number
  currentRating: number
  ratingDelta: number
  rank: number
}

// ============================================
// Platform Stats
// ============================================

/**
 * Get platform-wide statistics for the global dashboard.
 */
export async function getPlatformStats(
  client: SupabaseClient<Database>
): Promise<Result<PlatformStats>> {
  const [matchesResult, playersResult, decksResult, collectionsResult] = await Promise.all([
    client.from('matches').select('id', { count: 'exact', head: true }),
    client.from('profiles').select('id', { count: 'exact', head: true }),
    client.from('decks').select('id', { count: 'exact', head: true }),
    client.from('collections').select('id', { count: 'exact', head: true }),
  ])

  const error =
    matchesResult.error ||
    playersResult.error ||
    decksResult.error ||
    collectionsResult.error

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      totalMatches: matchesResult.count ?? 0,
      totalPlayers: playersResult.count ?? 0,
      totalDecks: decksResult.count ?? 0,
      totalCollections: collectionsResult.count ?? 0,
    },
  }
}

// ============================================
// User Stats
// ============================================

export type GetUserStatsOptions = {
  collectionId?: string
}

/**
 * Get statistics for a specific user, optionally within a collection.
 */
export async function getUserStats(
  client: SupabaseClient<Database>,
  userId: string,
  options: GetUserStatsOptions = {}
): Promise<Result<UserStats>> {
  const { collectionId } = options

  // Base participations query
  let participationsQuery = client
    .from('match_participants')
    .select('match_id, is_winner')
    .eq('user_id', userId)

  // Filter by collection if specified
  if (collectionId) {
    const { data: collectionMatches } = await client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)

    if (collectionMatches && collectionMatches.length > 0) {
      const matchIds = collectionMatches.map((cm) => cm.match_id)
      participationsQuery = participationsQuery.in('match_id', matchIds)
    } else {
      // No matches in collection
      return {
        success: true,
        data: {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentRating: 1000,
          ratingDelta: 0,
          rank: 0,
        },
      }
    }
  }

  const { data: participations, error: partError } = await participationsQuery

  if (partError) {
    return { success: false, error: partError.message }
  }

  const matchesPlayed = participations?.length ?? 0
  const wins = participations?.filter((p) => p.is_winner).length ?? 0
  const losses = matchesPlayed - wins
  const winRate = matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0

  // Get rating
  let ratingQuery = client
    .from('ratings')
    .select('rating')
    .eq('user_id', userId)

  if (collectionId) {
    ratingQuery = ratingQuery.eq('collection_id', collectionId)
  }

  const { data: rating } = await ratingQuery.limit(1).single()
  const currentRating = rating?.rating ?? 1000

  // Get recent rating delta
  let historyQuery = client
    .from('rating_history')
    .select('rating_after, rating_before')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (collectionId) {
    historyQuery = historyQuery.eq('collection_id', collectionId)
  }

  const { data: recentHistory } = await historyQuery

  const ratingDelta =
    recentHistory?.[0]
      ? recentHistory[0].rating_after - recentHistory[0].rating_before
      : 0

  // Calculate rank within collection or platform
  let rankQuery = client
    .from('ratings')
    .select('user_id, rating')
    .order('rating', { ascending: false })

  if (collectionId) {
    rankQuery = rankQuery.eq('collection_id', collectionId)
  }

  const { data: allRatings } = await rankQuery

  const rank = allRatings
    ? allRatings.findIndex((r) => r.user_id === userId) + 1
    : 0

  return {
    success: true,
    data: {
      matchesPlayed,
      wins,
      losses,
      winRate,
      currentRating,
      ratingDelta,
      rank,
    },
  }
}
