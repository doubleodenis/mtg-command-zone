/**
 * Rating Supabase Query Helpers
 *
 * All queries for ratings, rating history, and user statistics.
 * Uses the get_or_create_rating and get_user_stats database functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { Rating, RatingWithFormat, RatingHistory, RatingHistoryEntry } from '@/types/rating'
import type { PlayerStats, FormatStats } from '@/types/profile'
import type { Bracket } from '@/types/common'
import { mapRatingRow, mapRatingHistoryRow } from '@/types/database-mappers'
import { RATING_CONFIG } from '@/types/rating'

// ============================================
// Rating Queries
// ============================================

/**
 * Get a user's rating for a specific format
 * Creates a new rating record at default value if none exists
 */
export async function getRating(
  client: SupabaseClient<Database>,
  userId: string,
  formatId: string,
  collectionId?: string
): Promise<Result<Rating>> {
  // Use the database function that handles get-or-create
  const { data, error } = await client.rpc('get_or_create_rating', {
    p_user_id: userId,
    p_format_id: formatId,
    p_collection_id: collectionId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // The function returns a single rating row (cast through unknown for safety)
  const row = data as unknown as {
    id: string
    user_id: string
    format_id: string
    collection_id: string | null
    rating: number
    matches_played: number
    updated_at: string
  } | null

  if (!row) {
    return { success: false, error: 'Failed to get or create rating' }
  }

  return {
    success: true,
    data: {
      id: row.id,
      userId: row.user_id,
      formatId: row.format_id,
      collectionId: row.collection_id,
      rating: row.rating,
      matchesPlayed: row.matches_played,
      updatedAt: row.updated_at,
    },
  }
}

/**
 * Get all ratings for a user (across all formats)
 */
export async function getUserRatings(
  client: SupabaseClient<Database>,
  userId: string,
  collectionId?: string
): Promise<Result<RatingWithFormat[]>> {
  let query = client
    .from('ratings')
    .select(`
      *,
      format:formats!ratings_format_id_fkey(name, slug)
    `)
    .eq('user_id', userId)

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.is('collection_id', null)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((r) => ({
      ...mapRatingRow(r),
      formatName: r.format.name,
      formatSlug: r.format.slug,
    })),
  }
}

/**
 * Get user stats using the database function
 */
export async function getUserStats(
  client: SupabaseClient<Database>,
  userId: string,
  formatId?: string,
  collectionId?: string
): Promise<Result<PlayerStats>> {
  const { data, error } = await client.rpc('get_user_stats', {
    p_user_id: userId,
    p_format_id: formatId,
    p_collection_id: collectionId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // The function returns a TABLE (array) - get first row
  const rows = data as unknown as Array<{
    total_matches: number
    wins: number
    losses: number
    win_rate: number
  }> | null

  const stats = rows?.[0]

  if (!stats) {
    return {
      success: true,
      data: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        currentStreak: 0,
        longestWinStreak: 0,
      },
    }
  }

  return {
    success: true,
    data: {
      totalMatches: stats.total_matches,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.win_rate,
      // These aren't provided by the DB function yet - use defaults
      currentStreak: 0,
      longestWinStreak: 0,
    },
  }
}

/**
 * Get format-specific stats for a user
 */
export async function getFormatStats(
  client: SupabaseClient<Database>,
  userId: string,
  collectionId?: string
): Promise<Result<FormatStats[]>> {
  // Get all formats
  const { data: formats, error: formatsError } = await client
    .from('formats')
    .select('id, name, slug')
    .eq('is_active', true)

  if (formatsError) {
    return { success: false, error: formatsError.message }
  }

  // Get stats for each format
  const statsPromises = formats.map(async (format) => {
    const [ratingResult, statsResult] = await Promise.all([
      getRating(client, userId, format.id, collectionId),
      getUserStats(client, userId, format.id, collectionId),
    ])

    const baseStats = statsResult.success
      ? statsResult.data
      : {
          totalMatches: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          currentStreak: 0,
          longestWinStreak: 0,
        }

    return {
      ...baseStats,
      formatId: format.id,
      formatName: format.name,
    }
  })

  const allStats = await Promise.all(statsPromises)

  // Filter out formats with no matches
  const activeStats = allStats.filter((s) => s.totalMatches > 0)

  return { success: true, data: activeStats }
}

// ============================================
// Rating History Queries
// ============================================

/**
 * Get rating history for a user
 */
export async function getRatingHistory(
  client: SupabaseClient<Database>,
  userId: string,
  options: {
    formatId?: string
    collectionId?: string
    limit?: number
  } = {}
): Promise<Result<RatingHistory[]>> {
  let query = client
    .from('rating_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (options.formatId) {
    query = query.eq('format_id', options.formatId)
  }

  if (options.collectionId) {
    query = query.eq('collection_id', options.collectionId)
  } else if (options.collectionId === undefined) {
    // Default to global history if not specified
    query = query.is('collection_id', null)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map(mapRatingHistoryRow) }
}

/**
 * Get rating timeline for charts
 * Returns rating history entries in chronological order
 */
export async function getRatingTimeline(
  client: SupabaseClient<Database>,
  userId: string,
  options: {
    formatId?: string
    collectionId?: string
    limit?: number
  } = {}
): Promise<Result<Array<{ date: string; rating: number }>>> {
  let query = client
    .from('rating_history')
    .select('created_at, rating_after')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (options.formatId) {
    query = query.eq('format_id', options.formatId)
  }

  if (options.collectionId) {
    query = query.eq('collection_id', options.collectionId)
  } else if (options.collectionId === undefined) {
    query = query.is('collection_id', null)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  // Add starting point (default rating)
  const timeline = [
    { date: new Date(0).toISOString(), rating: RATING_CONFIG.defaultRating },
    ...data.map((row) => ({
      date: row.created_at ?? new Date().toISOString(),
      rating: row.rating_after,
    })),
  ]

  return { success: true, data: timeline }
}

/**
 * Get rating history entry with match details
 */
export async function getRatingHistoryEntry(
  client: SupabaseClient<Database>,
  historyId: string
): Promise<Result<RatingHistoryEntry>> {
  const { data: history, error: historyError } = await client
    .from('rating_history')
    .select('*')
    .eq('id', historyId)
    .single()

  if (historyError) {
    return { success: false, error: historyError.message }
  }

  // Get match details
  const { data: match, error: matchError } = await client
    .from('matches')
    .select('played_at')
    .eq('id', history.match_id)
    .single()

  if (matchError) {
    return { success: false, error: matchError.message }
  }

  // Get participant info
  const { data: participant, error: participantError } = await client
    .from('match_participants')
    .select('is_winner')
    .eq('match_id', history.match_id)
    .eq('user_id', history.user_id)
    .single()

  if (participantError) {
    return { success: false, error: participantError.message }
  }

  // Count opponents
  const { count: opponentCount } = await client
    .from('match_participants')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', history.match_id)
    .neq('user_id', history.user_id)

  return {
    success: true,
    data: {
      ...mapRatingHistoryRow(history),
      matchDate: match.played_at,
      isWin: participant.is_winner,
      opponentCount: opponentCount ?? 0,
    },
  }
}

// ============================================
// Rating Mutations (typically triggered by match confirmation)
// ============================================

/**
 * Update a user's rating after a match
 * This is typically called by a database trigger, but exposed for testing
 */
export async function updateRating(
  client: SupabaseClient<Database>,
  userId: string,
  formatId: string,
  newRating: number,
  incrementMatchCount: boolean,
  collectionId?: string
): Promise<Result<Rating>> {
  // First get current rating to increment matches_played
  let query = client
    .from('ratings')
    .select('matches_played')
    .eq('user_id', userId)
    .eq('format_id', formatId)

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  } else {
    query = query.is('collection_id', null)
  }

  const { data: current, error: fetchError } = await query.single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  const newMatchesPlayed = incrementMatchCount
    ? (current?.matches_played ?? 0) + 1
    : (current?.matches_played ?? 0)

  let updateQuery = client
    .from('ratings')
    .update({
      rating: newRating,
      matches_played: newMatchesPlayed,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('format_id', formatId)

  if (collectionId) {
    updateQuery = updateQuery.eq('collection_id', collectionId)
  } else {
    updateQuery = updateQuery.is('collection_id', null)
  }

  const { data, error } = await updateQuery.select().single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapRatingRow(data) }
}

/**
 * Record a rating history entry
 */
export async function recordRatingHistory(
  client: SupabaseClient<Database>,
  entry: {
    userId: string
    matchId: string
    formatId: string
    collectionId?: string
    ratingBefore: number
    ratingAfter: number
    delta: number
    playerBracket: Bracket
    opponentAvgRating: number
    opponentAvgBracket: number
    kFactor: number
    algorithmVersion: number
  }
): Promise<Result<RatingHistory>> {
  const { data, error } = await client
    .from('rating_history')
    .insert({
      user_id: entry.userId,
      match_id: entry.matchId,
      format_id: entry.formatId,
      collection_id: entry.collectionId ?? null,
      rating_before: entry.ratingBefore,
      rating_after: entry.ratingAfter,
      delta: entry.delta,
      player_bracket: entry.playerBracket,
      opponent_avg_rating: entry.opponentAvgRating,
      opponent_avg_bracket: entry.opponentAvgBracket,
      k_factor: entry.kFactor,
      algorithm_version: entry.algorithmVersion,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapRatingHistoryRow(data) }
}

// ============================================
// Collection-Scoped Rating Updates
// ============================================

/**
 * Update ratings for all collections a user is a member of for a match
 * 
 * This is called after confirming a match participation. For each collection
 * the match belongs to where the user is a member, it:
 * 1. Gets the user's collection-scoped rating
 * 2. Calculates the rating change
 * 3. Updates the collection-scoped rating
 * 4. Records collection-scoped rating history
 */
export async function updateCollectionRatings(
  client: SupabaseClient<Database>,
  params: {
    userId: string
    matchId: string
    formatId: string
    playerBracket: Bracket
    isWinner: boolean
    opponents: Array<{ rating: number; bracket: Bracket }>
    collectionIds: string[]  // Collections user is a member of that the match belongs to
    algorithmVersion: number
  }
): Promise<Result<Array<{ collectionId: string; delta: number; newRating: number }>>> {
  // Import calculateRating lazily to avoid circular dependencies
  const { calculateRating } = await import('@/lib/rating')
  
  const results: Array<{ collectionId: string; delta: number; newRating: number }> = []

  for (const collectionId of params.collectionIds) {
    // Get collection-scoped rating for this user
    const ratingResult = await getRating(client, params.userId, params.formatId, collectionId)
    if (!ratingResult.success) {
      console.error(`Failed to get collection rating for ${collectionId}:`, ratingResult.error)
      continue
    }

    const collectionRating = ratingResult.data

    // Calculate rating change for this collection
    const ratingCalc = calculateRating({
      playerId: params.userId,
      playerRating: collectionRating.rating,
      playerBracket: params.playerBracket,
      playerMatchCount: collectionRating.matchesPlayed,
      isWinner: params.isWinner,
      opponents: params.opponents,
      formatId: params.formatId,
      collectionId,
    })

    // Update collection-scoped rating
    const newRating = collectionRating.rating + ratingCalc.delta
    const updateResult = await updateRating(
      client,
      params.userId,
      params.formatId,
      newRating,
      true, // increment match count
      collectionId
    )

    if (!updateResult.success) {
      console.error(`Failed to update collection rating for ${collectionId}:`, updateResult.error)
      continue
    }

    // Record collection-scoped rating history
    await recordRatingHistory(client, {
      userId: params.userId,
      matchId: params.matchId,
      formatId: params.formatId,
      collectionId,
      ratingBefore: collectionRating.rating,
      ratingAfter: newRating,
      delta: ratingCalc.delta,
      playerBracket: params.playerBracket,
      opponentAvgRating: ratingCalc.opponentAvgRating,
      opponentAvgBracket: ratingCalc.opponentAvgBracket,
      kFactor: ratingCalc.kFactor,
      algorithmVersion: params.algorithmVersion,
    })

    results.push({
      collectionId,
      delta: ratingCalc.delta,
      newRating,
    })
  }

  return { success: true, data: results }
}
