/**
 * Stats Service
 *
 * Business logic for platform-wide and user statistics.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import {
  buildMeetings,
  calculateRivalryStreak,
  calculateRatingGapTrend,
} from './head-to-head-meetings'
import type {
  SharedMatchInfo,
  RatingHistoryRow,
  Meeting,
  RivalryStreak,
  RatingGapTrend,
} from './head-to-head-meetings'

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

// ============================================
// Head-to-Head Comparison
// ============================================

type RelationshipRecord = {
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

type FormatVsRecord = {
  formatSlug: string
  formatName: string
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

export type HeadToHeadComparison = {
  you: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    stats: { totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; longestWinStreak: number }
    rating: number
  }
  opponent: {
    id: string
    username: string
    displayName: string | null
    avatarUrl: string | null
    stats: { totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; longestWinStreak: number }
    rating: number
  }
  asEnemies: RelationshipRecord
  asTeammates: RelationshipRecord
  byFormat: FormatVsRecord[]
  firstMetAt: string | null
  mostRecentMatchAt: string | null
  currentStreak: RivalryStreak | null
  meetings: Meeting[]
  ratingGapTrend: RatingGapTrend | null
}

/**
 * Get head-to-head comparison data between two players.
 * From current user's perspective (wins/losses are "your" results against opponent).
 */
export async function getHeadToHeadComparison(
  client: SupabaseClient<Database>,
  currentUserId: string,
  targetUserId: string
): Promise<Result<HeadToHeadComparison>> {
  // Fetch both user profiles
  const [currentUserResult, targetUserResult] = await Promise.all([
    client.from('profiles').select('id, username, display_name, avatar_url').eq('id', currentUserId).single(),
    client.from('profiles').select('id, username, display_name, avatar_url').eq('id', targetUserId).single(),
  ])

  if (currentUserResult.error || targetUserResult.error) {
    return { success: false, error: 'Could not fetch user profiles' }
  }

  // Get all matches where target user participated
  const { data: targetParticipations, error: targetPartError } = await client
    .from('match_participants')
    .select(`
      match_id,
      is_winner,
      team
    `)
    .eq('user_id', targetUserId)

  if (targetPartError) {
    return { success: false, error: targetPartError.message }
  }

  const targetMatchIds = targetParticipations?.map((p) => p.match_id) ?? []

  if (targetMatchIds.length === 0) {
    // No matches with target - return empty comparison
    return buildEmptyComparison(currentUserResult.data, targetUserResult.data)
  }

  // Get current user's participations in those same matches
  const { data: currentParticipations, error: currentPartError } = await client
    .from('match_participants')
    .select(`
      match_id,
      is_winner,
      team
    `)
    .eq('user_id', currentUserId)
    .in('match_id', targetMatchIds)

  if (currentPartError) {
    return { success: false, error: currentPartError.message }
  }

  const sharedMatchIds = currentParticipations?.map((p) => p.match_id) ?? []

  if (sharedMatchIds.length === 0) {
    return buildEmptyComparison(currentUserResult.data, targetUserResult.data)
  }

  // Fetch match details for format info
  const { data: matchDetails, error: matchError } = await client
    .from('matches')
    .select(`
      id,
      format_id,
      played_at,
      is_dirty,
      formats (
        slug,
        name
      )
    `)
    .in('id', sharedMatchIds)

  if (matchError) {
    return { success: false, error: matchError.message }
  }

  // Fetch rating history for both players on the shared matches, used to build the rivalry timeline
  const { data: ratingHistoryRows, error: ratingHistoryError } = await client
    .from('rating_history')
    .select('match_id, user_id, rating_after')
    .in('match_id', sharedMatchIds)
    .in('user_id', [currentUserId, targetUserId])

  if (ratingHistoryError) {
    return { success: false, error: ratingHistoryError.message }
  }

  // Create lookup maps
  const targetTeamByMatch = new Map(
    targetParticipations
      ?.filter((p) => sharedMatchIds.includes(p.match_id))
      .map((p) => [p.match_id, p.team])
  )

  const matchInfoLookup = new Map(
    matchDetails?.map((m) => [
      m.id,
      {
        formatSlug: (m.formats as { slug: string } | null)?.slug ?? 'unknown',
        formatName: (m.formats as { name: string } | null)?.name ?? 'Unknown',
        playedAt: m.played_at,
        isDirty: m.is_dirty,
      },
    ])
  )

  // Calculate stats
  const asEnemies = { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0 }
  const asTeammates = { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0 }
  const formatMap = new Map<string, { slug: string; name: string; wins: number; losses: number }>()

  for (const p of currentParticipations ?? []) {
    const targetTeam = targetTeamByMatch.get(p.match_id)
    const formatInfo = matchInfoLookup.get(p.match_id)
    const isWin = p.is_winner
    const isSameTeam = p.team !== null && p.team === targetTeam

    // Relationship tracking
    if (isSameTeam) {
      asTeammates.matchesPlayed++
      if (isWin) asTeammates.wins++
      else asTeammates.losses++
    } else {
      asEnemies.matchesPlayed++
      if (isWin) asEnemies.wins++
      else asEnemies.losses++
    }

    // Format tracking (only count as enemies for format stats)
    if (!isSameTeam && formatInfo) {
      const existing = formatMap.get(formatInfo.formatSlug)
      if (existing) {
        if (isWin) existing.wins++
        else existing.losses++
      } else {
        formatMap.set(formatInfo.formatSlug, {
          slug: formatInfo.formatSlug,
          name: formatInfo.formatName,
          wins: isWin ? 1 : 0,
          losses: isWin ? 0 : 1,
        })
      }
    }
  }

  // Calculate win rates
  const calcWinRate = (w: number, total: number) => (total > 0 ? Math.round((w / total) * 100) : 0)

  asEnemies.winRate = calcWinRate(asEnemies.wins, asEnemies.matchesPlayed)
  asTeammates.winRate = calcWinRate(asTeammates.wins, asTeammates.matchesPlayed)

  // Format breakdown
  const byFormat: FormatVsRecord[] = Array.from(formatMap.values())
    .map((f) => ({
      formatSlug: f.slug,
      formatName: f.name,
      wins: f.wins,
      losses: f.losses,
      matchesPlayed: f.wins + f.losses,
      winRate: calcWinRate(f.wins, f.wins + f.losses),
    }))
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed)

  // Build the rivalry-timeline inputs and compute meetings/streak/rating-gap trend
  const sharedMatchInfos: SharedMatchInfo[] = (currentParticipations ?? [])
    .map((p) => {
      const info = matchInfoLookup.get(p.match_id)
      if (!info) return null
      return {
        matchId: p.match_id,
        playedAt: info.playedAt,
        isDirty: info.isDirty,
        formatSlug: info.formatSlug,
        formatName: info.formatName,
        isWin: p.is_winner,
      }
    })
    .filter((m): m is SharedMatchInfo => m !== null)

  const ratingRows: RatingHistoryRow[] = (ratingHistoryRows ?? []).map((r) => ({
    matchId: r.match_id,
    userId: r.user_id,
    ratingAfter: r.rating_after,
  }))

  const meetings = buildMeetings(sharedMatchInfos, ratingRows, currentUserId, targetUserId)
  const currentStreak = calculateRivalryStreak(sharedMatchInfos)
  const ratingGapTrend = calculateRatingGapTrend(meetings)

  const playedDates = sharedMatchInfos.map((m) => new Date(m.playedAt).getTime())
  const firstMetAt = playedDates.length > 0 ? new Date(Math.min(...playedDates)).toISOString() : null
  const mostRecentMatchAt = playedDates.length > 0 ? new Date(Math.max(...playedDates)).toISOString() : null

  // Get overall stats for both users
  const [currentStats, targetStats, currentRatings, targetRatings] = await Promise.all([
    getUserOverallStats(client, currentUserId),
    getUserOverallStats(client, targetUserId),
    client.from('ratings').select('rating').eq('user_id', currentUserId),
    client.from('ratings').select('rating').eq('user_id', targetUserId),
  ])

  const currentRating = currentRatings.data?.length
    ? Math.round(currentRatings.data.reduce((sum, r) => sum + r.rating, 0) / currentRatings.data.length)
    : 1000

  const targetRating = targetRatings.data?.length
    ? Math.round(targetRatings.data.reduce((sum, r) => sum + r.rating, 0) / targetRatings.data.length)
    : 1000

  return {
    success: true,
    data: {
      you: {
        id: currentUserResult.data.id,
        username: currentUserResult.data.username,
        displayName: currentUserResult.data.display_name ?? null,
        avatarUrl: currentUserResult.data.avatar_url,
        stats: currentStats,
        rating: currentRating,
      },
      opponent: {
        id: targetUserResult.data.id,
        username: targetUserResult.data.username,
        displayName: targetUserResult.data.display_name ?? null,
        avatarUrl: targetUserResult.data.avatar_url,
        stats: targetStats,
        rating: targetRating,
      },
      asEnemies: {
        wins: asEnemies.wins,
        losses: asEnemies.losses,
        matchesPlayed: asEnemies.matchesPlayed,
        winRate: asEnemies.winRate,
      },
      asTeammates: {
        wins: asTeammates.wins,
        losses: asTeammates.losses,
        matchesPlayed: asTeammates.matchesPlayed,
        winRate: asTeammates.winRate,
      },
      byFormat,
      firstMetAt,
      mostRecentMatchAt,
      currentStreak,
      meetings,
      ratingGapTrend,
    },
  }
}

/**
 * Helper: Get basic overall stats for a user
 */
async function getUserOverallStats(
  client: SupabaseClient<Database>,
  userId: string
): Promise<{ totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; longestWinStreak: number }> {
  const { data } = await client
    .from('match_participants')
    .select('is_winner')
    .eq('user_id', userId)

  const totalMatches = data?.length ?? 0
  const wins = data?.filter((p) => p.is_winner).length ?? 0
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  // Note: Streak calculation would require ordered match data
  // For head-to-head we just return 0 for these since they're not displayed
  return { totalMatches, wins, losses, winRate, currentStreak: 0, longestWinStreak: 0 }
}

/**
 * Helper: Build empty comparison when users have no shared matches
 */
async function buildEmptyComparison(
  currentUser: { id: string; username: string; display_name: string | null; avatar_url: string | null },
  targetUser: { id: string; username: string; display_name: string | null; avatar_url: string | null }
): Promise<Result<HeadToHeadComparison>> {
  const emptyRecord: RelationshipRecord = { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0 }

  return {
    success: true,
    data: {
      you: {
        id: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.display_name ?? null,
        avatarUrl: currentUser.avatar_url,
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, currentStreak: 0, longestWinStreak: 0 },
        rating: 1000,
      },
      opponent: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.display_name ?? null,
        avatarUrl: targetUser.avatar_url,
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, currentStreak: 0, longestWinStreak: 0 },
        rating: 1000,
      },
      asEnemies: emptyRecord,
      asTeammates: emptyRecord,
      byFormat: [],
      firstMetAt: null,
      mostRecentMatchAt: null,
      currentStreak: null,
      meetings: [],
      ratingGapTrend: null,
    },
  }
}
