/**
 * Collection Supabase Query Helpers
 *
 * All queries for collection CRUD, membership, and match management.
 * Uses mappers at the boundary to convert DB types to application types.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type {
  Collection,
  CollectionSummary,
  CollectionMember,
  CollectionMemberWithProfile,
  CollectionWithMembers,
  CollectionWithMembership,
  CollectionMatch,
  CreateCollectionPayload,
  UpdateCollectionPayload,
  ApprovalStatus,
  PendingMatchApproval,
} from '@/types/collection'
import {
  mapCollectionRow,
  mapCollectionSummary,
  mapCollectionMemberRow,
  mapCollectionMemberWithProfile,
  mapProfileSummary,
} from '@/types/database-mappers'

// ============================================
// Collection Queries
// ============================================

/**
 * Get a collection by ID
 */
export async function getCollectionById(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<Collection>> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('id', collectionId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapCollectionRow(data) }
}

/**
 * Get collections the user is a member of
 */
export async function getUserCollections(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<CollectionWithMembership[]>> {
  // Get collection IDs where user is a member
  const { data: memberships, error: membershipError } = await client
    .from('collection_members')
    .select('collection_id, role')
    .eq('user_id', userId)

  if (membershipError) {
    return { success: false, error: membershipError.message }
  }

  if (memberships.length === 0) {
    return { success: true, data: [] }
  }

  const collectionIds = memberships.map((m) => m.collection_id)

  // Get collections with counts
  const { data: collections, error: collectionsError } = await client
    .from('collections')
    .select('*')
    .in('id', collectionIds)

  if (collectionsError) {
    return { success: false, error: collectionsError.message }
  }

  // Get member and match counts for each collection
  const countsPromises = collections.map(async (c) => {
    const [memberCount, matchCount] = await Promise.all([
      client.from('collection_members').select('*', { count: 'exact', head: true }).eq('collection_id', c.id),
      client.from('collection_matches').select('*', { count: 'exact', head: true }).eq('collection_id', c.id).eq('approval_status', 'approved'),
    ])
    return {
      collectionId: c.id,
      memberCount: memberCount.count ?? 0,
      matchCount: matchCount.count ?? 0,
    }
  })

  const counts = await Promise.all(countsPromises)
  const countsMap = new Map(counts.map((c) => [c.collectionId, c]))

  // Build membership map
  const membershipMap = new Map(memberships.map((m) => [m.collection_id, m.role]))

  // Map to CollectionWithMembership
  const result: CollectionWithMembership[] = collections.map((c) => {
    const countData = countsMap.get(c.id) ?? { memberCount: 0, matchCount: 0 }
    return {
      ...mapCollectionRow(c),
      isMember: true,
      userRole: membershipMap.get(c.id) as 'owner' | 'member',
      memberCount: countData.memberCount,
      matchCount: countData.matchCount,
    }
  })

  return { success: true, data: result }
}

/**
 * Get a collection with all members
 */
export async function getCollectionWithMembers(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<CollectionWithMembers>> {
  const { data: collection, error: collectionError } = await client
    .from('collections')
    .select(`
      *,
      owner:profiles!collections_owner_id_fkey(*)
    `)
    .eq('id', collectionId)
    .single()

  if (collectionError) {
    return { success: false, error: collectionError.message }
  }

  const { data: members, error: membersError } = await client
    .from('collection_members')
    .select(`
      *,
      profile:profiles!collection_members_user_id_fkey(*)
    `)
    .eq('collection_id', collectionId)

  if (membersError) {
    return { success: false, error: membersError.message }
  }

  return {
    success: true,
    data: {
      ...mapCollectionRow(collection),
      owner: mapProfileSummary(collection.owner),
      members: members.map((m) => mapCollectionMemberWithProfile(m, m.profile)),
    },
  }
}

/**
 * Get collection summary with counts
 */
export async function getCollectionSummary(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<CollectionSummary>> {
  const [collectionResult, memberCountResult, matchCountResult] = await Promise.all([
    client.from('collections').select('*').eq('id', collectionId).single(),
    client.from('collection_members').select('*', { count: 'exact', head: true }).eq('collection_id', collectionId),
    client.from('collection_matches').select('*', { count: 'exact', head: true }).eq('collection_id', collectionId).eq('approval_status', 'approved'),
  ])

  if (collectionResult.error) {
    return { success: false, error: collectionResult.error.message }
  }

  return {
    success: true,
    data: mapCollectionSummary(
      collectionResult.data,
      memberCountResult.count ?? 0,
      matchCountResult.count ?? 0
    ),
  }
}

/**
 * Search public collections
 */
export async function searchPublicCollections(
  client: SupabaseClient<Database>,
  query: string,
  limit = 10
): Promise<Result<CollectionSummary[]>> {
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('is_public', true)
    .ilike('name', `%${query}%`)
    .limit(limit)

  if (error) {
    return { success: false, error: error.message }
  }

  // Get counts for each collection
  const countsPromises = data.map(async (c) => {
    const [memberCount, matchCount] = await Promise.all([
      client.from('collection_members').select('*', { count: 'exact', head: true }).eq('collection_id', c.id),
      client.from('collection_matches').select('*', { count: 'exact', head: true }).eq('collection_id', c.id).eq('approval_status', 'approved'),
    ])
    return {
      collection: c,
      memberCount: memberCount.count ?? 0,
      matchCount: matchCount.count ?? 0,
    }
  })

  const withCounts = await Promise.all(countsPromises)

  return {
    success: true,
    data: withCounts.map((c) => mapCollectionSummary(c.collection, c.memberCount, c.matchCount)),
  }
}

// ============================================
// Collection Mutations
// ============================================

/**
 * Create a new collection
 */
export async function createCollection(
  client: SupabaseClient<Database>,
  userId: string,
  payload: CreateCollectionPayload
): Promise<Result<Collection>> {
  // Create the collection
  const { data: collection, error: collectionError } = await client
    .from('collections')
    .insert({
      owner_id: userId,
      name: payload.name,
      description: payload.description ?? null,
      is_public: payload.isPublic ?? false,
      match_add_permission: payload.matchAddPermission ?? 'owner_only',
      ...(payload.autoApproveMembers !== undefined && { auto_approve_members: payload.autoApproveMembers }),
    })
    .select()
    .single()

  if (collectionError) {
    return { success: false, error: collectionError.message }
  }

  // Add owner as a member with 'owner' role
  const { error: memberError } = await client
    .from('collection_members')
    .insert({
      collection_id: collection.id,
      user_id: userId,
      role: 'owner',
    })

  if (memberError) {
    // Rollback: delete the collection if member creation fails
    await client.from('collections').delete().eq('id', collection.id)
    return { success: false, error: memberError.message }
  }

  return { success: true, data: mapCollectionRow(collection) }
}

/**
 * Update a collection
 */
export async function updateCollection(
  client: SupabaseClient<Database>,
  collectionId: string,
  payload: UpdateCollectionPayload
): Promise<Result<Collection>> {
  const updates: Record<string, unknown> = {}

  if (payload.name !== undefined) updates.name = payload.name
  if (payload.description !== undefined) updates.description = payload.description
  if (payload.isPublic !== undefined) updates.is_public = payload.isPublic
  if (payload.matchAddPermission !== undefined) updates.match_add_permission = payload.matchAddPermission
  if (payload.autoApproveMembers !== undefined) updates.auto_approve_members = payload.autoApproveMembers

  const { data, error } = await client
    .from('collections')
    .update(updates)
    .eq('id', collectionId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapCollectionRow(data) }
}

/**
 * Delete a collection (owner only)
 */
export async function deleteCollection(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<null>> {
  const { error } = await client
    .from('collections')
    .delete()
    .eq('id', collectionId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

// ============================================
// Collection Membership
// ============================================

/**
 * Add a member to a collection
 */
export async function addCollectionMember(
  client: SupabaseClient<Database>,
  collectionId: string,
  userId: string
): Promise<Result<CollectionMember>> {
  const { data, error } = await client
    .from('collection_members')
    .insert({
      collection_id: collectionId,
      user_id: userId,
      role: 'member',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapCollectionMemberRow(data) }
}

/**
 * Remove a member from a collection
 */
export async function removeCollectionMember(
  client: SupabaseClient<Database>,
  collectionId: string,
  userId: string
): Promise<Result<null>> {
  const { error } = await client
    .from('collection_members')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Get collection members
 */
export async function getCollectionMembers(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<CollectionMemberWithProfile[]>> {
  const { data, error } = await client
    .from('collection_members')
    .select(`
      *,
      profile:profiles!collection_members_user_id_fkey(*)
    `)
    .eq('collection_id', collectionId)

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((m) => mapCollectionMemberWithProfile(m, m.profile)),
  }
}

/**
 * Check if a user is a member of a collection
 */
export async function isCollectionMember(
  client: SupabaseClient<Database>,
  collectionId: string,
  userId: string
): Promise<Result<boolean>> {
  const { count, error } = await client
    .from('collection_members')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collectionId)
    .eq('user_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: (count ?? 0) > 0 }
}

// ============================================
// Collection Matches
// ============================================

/**
 * Add a match to a collection
 */
export async function addMatchToCollection(
  client: SupabaseClient<Database>,
  collectionId: string,
  matchId: string,
  addedBy: string,
  approvalStatus: ApprovalStatus = 'approved'
): Promise<Result<CollectionMatch>> {
  const { data, error } = await client
    .from('collection_matches')
    .insert({
      collection_id: collectionId,
      match_id: matchId,
      added_by: addedBy,
      approval_status: approvalStatus,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      id: data.id,
      collectionId: data.collection_id,
      matchId: data.match_id,
      addedBy: data.added_by,
      approvalStatus: data.approval_status as ApprovalStatus,
      addedAt: data.added_at ?? new Date().toISOString(),
    },
  }
}

/**
 * Update match approval status in a collection
 */
export async function updateMatchApprovalStatus(
  client: SupabaseClient<Database>,
  collectionMatchId: string,
  status: ApprovalStatus
): Promise<Result<null>> {
  const { error } = await client
    .from('collection_matches')
    .update({ approval_status: status })
    .eq('id', collectionMatchId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Remove a match from a collection
 */
export async function removeMatchFromCollection(
  client: SupabaseClient<Database>,
  collectionId: string,
  matchId: string
): Promise<Result<null>> {
  const { error } = await client
    .from('collection_matches')
    .delete()
    .eq('collection_id', collectionId)
    .eq('match_id', matchId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Get pending match approvals for a collection
 */
export async function getPendingMatchApprovals(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<CollectionMatch[]>> {
  const { data, error } = await client
    .from('collection_matches')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('approval_status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((m) => ({
      id: m.id,
      collectionId: m.collection_id,
      matchId: m.match_id,
      addedBy: m.added_by,
      approvalStatus: m.approval_status as ApprovalStatus,
      addedAt: m.added_at ?? new Date().toISOString(),
    })),
  }
}

/**
 * Get pending match approvals with full match and submitter details
 */
export async function getPendingMatchApprovalsWithDetails(
  client: SupabaseClient<Database>,
  collectionId: string
): Promise<Result<PendingMatchApproval[]>> {
  // Get pending collection_matches with joined data
  const { data, error } = await client
    .from('collection_matches')
    .select(`
      id,
      match_id,
      added_by,
      added_at,
      submitter:profiles!collection_matches_added_by_fkey(id, username, avatar_url),
      match:matches!collection_matches_match_id_fkey(
        id,
        played_at,
        format:formats!matches_format_id_fkey(name, slug)
      )
    `)
    .eq('collection_id', collectionId)
    .eq('approval_status', 'pending')
    .order('added_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data || data.length === 0) {
    return { success: true, data: [] }
  }

  // Get all match IDs to fetch participants
  const matchIds = data.map((d) => d.match_id)

  // Get participants for all matches
  const { data: participants, error: participantsError } = await client
    .from('match_participants')
    .select(`
      match_id,
      is_winner,
      placeholder_name,
      profile:profiles!match_participants_user_id_fkey(username)
    `)
    .in('match_id', matchIds)

  if (participantsError) {
    return { success: false, error: participantsError.message }
  }

  // Group participants by match ID
  const participantsByMatch = new Map<string, Array<{ isWinner: boolean; name: string }>>()
  for (const p of participants ?? []) {
    const existing = participantsByMatch.get(p.match_id) ?? []
    existing.push({
      isWinner: p.is_winner,
      name: p.profile?.username ?? p.placeholder_name ?? 'Unknown',
    })
    participantsByMatch.set(p.match_id, existing)
  }

  // Build result
  const result: PendingMatchApproval[] = data.map((d) => {
    const matchParticipants = participantsByMatch.get(d.match_id) ?? []
    const winnerNames = matchParticipants
      .filter((p) => p.isWinner)
      .map((p) => p.name)

    return {
      collectionMatchId: d.id,
      matchId: d.match_id,
      addedBy: {
        id: d.submitter?.id ?? d.added_by,
        username: d.submitter?.username ?? 'Unknown',
        avatarUrl: d.submitter?.avatar_url ?? null,
      },
      addedAt: d.added_at ?? new Date().toISOString(),
      matchSummary: {
        formatName: d.match?.format?.name ?? 'Unknown',
        formatSlug: d.match?.format?.slug ?? 'ffa',
        playedAt: d.match?.played_at ?? new Date().toISOString(),
        participantCount: matchParticipants.length,
        winnerNames,
      },
    }
  })

  return { success: true, data: result }
}

/**
 * Get all collections a match belongs to (approved only)
 * Returns collection IDs that the match is associated with
 */
export async function getMatchCollections(
  client: SupabaseClient<Database>,
  matchId: string
): Promise<Result<string[]>> {
  const { data, error } = await client
    .from('collection_matches')
    .select('collection_id')
    .eq('match_id', matchId)
    .eq('approval_status', 'approved')

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((cm) => cm.collection_id),
  }
}

/**
 * Get collections a user is a member of (for a specific set of collection IDs)
 * Used to filter which collections to update ratings for
 */
export async function getUserMemberCollections(
  client: SupabaseClient<Database>,
  userId: string,
  collectionIds: string[]
): Promise<Result<string[]>> {
  if (collectionIds.length === 0) {
    return { success: true, data: [] }
  }

  const { data, error } = await client
    .from('collection_members')
    .select('collection_id')
    .eq('user_id', userId)
    .in('collection_id', collectionIds)

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((cm) => cm.collection_id),
  }
}

/**
 * Auto-confirm all unconfirmed participants in a match who are members of a collection.
 * Used when a collection has auto_approve_members enabled.
 * Sets confirmed_at for each qualifying participant.
 * Returns the user IDs that were auto-confirmed.
 */
export async function autoConfirmCollectionMembers(
  client: SupabaseClient<Database>,
  matchId: string,
  collectionId: string
): Promise<Result<string[]>> {
  // Get all unconfirmed registered participants for this match
  const { data: participants, error: participantsError } = await client
    .from('match_participants')
    .select('id, user_id')
    .eq('match_id', matchId)
    .not('user_id', 'is', null)
    .is('confirmed_at', null)

  if (participantsError) {
    return { success: false, error: participantsError.message }
  }

  if (!participants || participants.length === 0) {
    return { success: true, data: [] }
  }

  // Get collection members that overlap with unconfirmed participants
  const userIds = participants.map((p) => p.user_id!)
  const { data: members, error: membersError } = await client
    .from('collection_members')
    .select('user_id')
    .eq('collection_id', collectionId)
    .in('user_id', userIds)

  if (membersError) {
    return { success: false, error: membersError.message }
  }

  if (!members || members.length === 0) {
    return { success: true, data: [] }
  }

  const memberIds = new Set(members.map((m) => m.user_id))
  const toConfirm = participants.filter((p) => memberIds.has(p.user_id!))

  if (toConfirm.length === 0) {
    return { success: true, data: [] }
  }

  const participantIds = toConfirm.map((p) => p.id)

  const { error: updateError } = await client
    .from('match_participants')
    .update({ confirmed_at: new Date().toISOString() })
    .in('id', participantIds)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, data: toConfirm.map((p) => p.user_id!) }
}
