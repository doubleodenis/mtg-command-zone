/**
 * Collection Service
 *
 * Business logic for collection-related data transformations and aggregations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { CollectionActivity, CollectionSummary } from '@/types/collection'
import type { ProfileSummary } from '@/types/profile'

// ============================================
// Collection Activities
// ============================================

/**
 * Get collection activities for a user showing recent stats and rating changes.
 */
export async function getUserCollectionActivities(
  client: SupabaseClient<Database>,
  userId: string,
  limit = 3
): Promise<Result<CollectionActivity[]>> {
  // Get collection memberships
  const { data: memberships, error } = await client
    .from('collection_members')
    .select(`
      collection_id,
      collection:collections!collection_members_collection_id_fkey(
        id,
        name,
        description,
        is_public
      )
    `)
    .eq('user_id', userId)
    .limit(limit)

  if (error) {
    return { success: false, error: error.message }
  }

  if (!memberships || memberships.length === 0) {
    return { success: true, data: [] }
  }

  // Build collection activities with stats
  const activities = await Promise.all(
    memberships.map((m) => buildCollectionActivity(client, m, userId))
  )

  return { success: true, data: activities }
}

/**
 * Build a CollectionActivity from a membership with user stats
 */
async function buildCollectionActivity(
  client: SupabaseClient<Database>,
  membership: {
    collection_id: string
    collection: {
      id: string
      name: string
      description: string | null
      is_public: boolean
    }
  },
  userId: string
): Promise<CollectionActivity> {
  const userStats = await calculateUserCollectionStats(client, membership.collection_id, userId)
  const topPlayer = await getCollectionTopPlayer(client, membership.collection_id)

  // Get member and match counts for collection summary
  const [memberCount, matchCount] = await Promise.all([
    client
      .from('collection_members')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', membership.collection_id),
    client
      .from('collection_matches')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', membership.collection_id),
  ])

  const collection: CollectionSummary = {
    id: membership.collection.id,
    name: membership.collection.name,
    description: membership.collection.description,
    isPublic: membership.collection.is_public,
    memberCount: memberCount.count ?? 0,
    matchCount: matchCount.count ?? 0,
  }

  return {
    collection,
    userStats,
    topPlayer,
  }
}

/**
 * Calculate user's stats within a collection
 */
async function calculateUserCollectionStats(
  client: SupabaseClient<Database>,
  collectionId: string,
  userId: string
): Promise<{
  gamesPlayed: number
  wins: number
  winRate: number
  rating: number
  ratingDelta: number
  unconfirmedMatchCount: number
  pendingApprovalCount: number
}> {
  // Run initial queries in parallel
  const [ratingResult, approvedMatchesResult, pendingMatchesResult] = await Promise.all([
    client
      .from('ratings')
      .select('rating')
      .eq('user_id', userId)
      .eq('collection_id', collectionId)
      .single(),
    client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)
      .eq('approval_status', 'approved'),
    client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)
      .eq('approval_status', 'pending'),
  ])

  const approvedMatchIds = approvedMatchesResult.data?.map((cm) => cm.match_id) ?? []
  const pendingMatchIds = pendingMatchesResult.data?.map((cm) => cm.match_id) ?? []

  // Run participant queries in parallel
  const [confirmedResult, unconfirmedResult, pendingParticipantResult, historyResult] =
    await Promise.all([
      // Confirmed participations (count toward gamesPlayed/wins)
      approvedMatchIds.length > 0
        ? client
            .from('match_participants')
            .select('is_winner')
            .eq('user_id', userId)
            .in('match_id', approvedMatchIds)
            .not('confirmed_at', 'is', null)
        : Promise.resolve({ data: [] }),
      // Approved matches user hasn't confirmed yet
      approvedMatchIds.length > 0
        ? client
            .from('match_participants')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('match_id', approvedMatchIds)
            .is('confirmed_at', null)
        : Promise.resolve({ count: 0 }),
      // Pending collection-approval matches user is a participant in
      pendingMatchIds.length > 0
        ? client
            .from('match_participants')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .in('match_id', pendingMatchIds)
        : Promise.resolve({ count: 0 }),
      // Most recent rating history entry for delta
      client
        .from('rating_history')
        .select('rating_after, rating_before')
        .eq('user_id', userId)
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false })
        .limit(1),
    ])

  const participations = confirmedResult.data ?? []
  const wins = participations.filter((p) => p.is_winner).length
  const gamesPlayed = participations.length
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0

  const ratingDelta =
    historyResult.data?.[0]
      ? historyResult.data[0].rating_after - historyResult.data[0].rating_before
      : 0

  return {
    gamesPlayed,
    wins,
    winRate,
    rating: ratingResult.data?.rating ?? 1000,
    ratingDelta,
    unconfirmedMatchCount: unconfirmedResult.count ?? 0,
    pendingApprovalCount: pendingParticipantResult.count ?? 0,
  }
}

/**
 * Get the top player in a collection by win rate
 */
async function getCollectionTopPlayer(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<{ profile: ProfileSummary; winRate: number; gamesPlayed: number } | undefined> {
  // Get all members with their ratings
  const { data: members } = await client
    .from('collection_members')
    .select(`
      user_id,
      profile:profiles!collection_members_user_id_fkey(id, username, avatar_url)
    `)
    .eq('collection_id', collectionId)

  if (!members || members.length === 0) {
    return undefined
  }

  // Get approved match participations in collection
  const { data: collectionMatches } = await client
    .from('collection_matches')
    .select('match_id')
    .eq('collection_id', collectionId)
    .eq('approval_status', 'approved')

  const matchIds = collectionMatches?.map((cm) => cm.match_id) ?? []

  if (matchIds.length === 0) {
    return undefined
  }

  // Calculate stats for each member and find the top one
  const memberStats = await Promise.all(
    members.map(async (member) => {
      const { data: participations } = await client
        .from('match_participants')
        .select('is_winner')
        .eq('user_id', member.user_id)
        .in('match_id', matchIds)
        .not('confirmed_at', 'is', null)

      const gamesPlayed = participations?.length ?? 0
      const wins = participations?.filter((p) => p.is_winner).length ?? 0
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0

      return {
        profile: {
          id: member.profile?.id ?? member.user_id,
          username: member.profile?.username ?? 'Unknown',
          avatarUrl: member.profile?.avatar_url ?? null,
        },
        winRate,
        gamesPlayed,
      }
    })
  )

  // Find member with highest win rate (with at least 1 game)
  const topPlayer = memberStats
    .filter((m) => m.gamesPlayed > 0)
    .sort((a, b) => b.winRate - a.winRate)[0]

  return topPlayer
}
