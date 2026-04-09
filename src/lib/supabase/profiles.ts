/**
 * Profile & Friends Supabase Query Helpers
 *
 * All queries for profiles, friends, and friend requests.
 * Uses mappers at the boundary to convert DB types to application types.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { Profile, ProfileSummary, LeaderboardEntry } from '@/types/profile'
import type { Friend, FriendRequest, Friendship, FriendshipStatus, OutgoingFriendRequest } from '@/types/friendship'
import {
  mapProfileRow,
  mapProfileSummary,
  mapFriendshipRow,
  mapFriendRow,
  mapFriendRequest,
  mapOutgoingFriendRequest,
  mapLeaderboardEntry,
  type LeaderboardFunctionResult,
} from '@/types/database-mappers'

// ============================================
// Profile Queries
// ============================================

/**
 * Get a profile by user ID
 */
export async function getProfileById(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<Profile>> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapProfileRow(data) }
}

/**
 * Get a profile by username
 */
export async function getProfileByUsername(
  client: SupabaseClient<Database>,
  username: string
): Promise<Result<Profile>> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapProfileRow(data) }
}

/**
 * Search profiles by display_name or username (partial match)
 * Prioritizes display_name matches, then username
 */
export async function searchProfiles(
  client: SupabaseClient<Database>,
  query: string,
  limit = 10
): Promise<Result<ProfileSummary[]>> {
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
    .limit(limit)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map(mapProfileSummary) }
}

/**
 * Update a user's profile
 */
export async function updateProfile(
  client: SupabaseClient<Database>,
  userId: string,
  updates: { username?: string; display_name?: string | null; avatar_url?: string }
): Promise<Result<Profile>> {
  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapProfileRow(data) }
}

// ============================================
// Friend Queries
// ============================================

/**
 * Get all accepted friends for a user
 */
export async function getFriends(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<Friend[]>> {
  // Get friendships where user is either requester or addressee
  const { data: friendships, error } = await client
    .from('friends')
    .select(`
      *,
      requester:profiles!friends_requester_id_fkey(*),
      addressee:profiles!friends_addressee_id_fkey(*)
    `)
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted')

  if (error) {
    return { success: false, error: error.message }
  }

  const friends: Friend[] = friendships.map((f) => {
    const isRequester = f.requester_id === userId
    const otherProfile = isRequester ? f.addressee : f.requester
    return mapFriendRow(f, otherProfile, isRequester)
  })

  return { success: true, data: friends }
}

/**
 * Get pending friend requests received by a user
 */
export async function getIncomingFriendRequests(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<FriendRequest[]>> {
  const { data, error } = await client
    .from('friends')
    .select(`
      *,
      requester:profiles!friends_requester_id_fkey(*)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map((f) => mapFriendRequest(f, f.requester)) }
}

/**
 * Get pending friend requests sent by a user
 */
export async function getOutgoingFriendRequests(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<OutgoingFriendRequest[]>> {
  const { data, error } = await client
    .from('friends')
    .select(`
      *,
      addressee:profiles!friends_addressee_id_fkey(*)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending')

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map((f) => mapOutgoingFriendRequest(f, f.addressee)) }
}

/**
 * Send a friend request
 */
export async function sendFriendRequest(
  client: SupabaseClient<Database>,
  requesterId: string,
  addresseeId: string
): Promise<Result<Friendship>> {
  const { data, error } = await client
    .from('friends')
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapFriendshipRow(data) }
}

/**
 * Respond to a friend request (accept, reject, or block)
 */
export async function respondToFriendRequest(
  client: SupabaseClient<Database>,
  friendshipId: string,
  status: FriendshipStatus
): Promise<Result<Friendship>> {
  const { data, error } = await client
    .from('friends')
    .update({ status })
    .eq('id', friendshipId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapFriendshipRow(data) }
}

/**
 * Remove a friend (delete the friendship record)
 */
export async function removeFriend(
  client: SupabaseClient<Database>,
  friendshipId: string
): Promise<Result<null>> {
  const { error } = await client
    .from('friends')
    .delete()
    .eq('id', friendshipId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Check friendship status between two users
 */
export async function getFriendshipStatus(
  client: SupabaseClient<Database>,
  userId1: string,
  userId2: string
): Promise<Result<Friendship | null>> {
  const { data, error } = await client
    .from('friends')
    .select('*')
    .or(
      `and(requester_id.eq.${userId1},addressee_id.eq.${userId2}),and(requester_id.eq.${userId2},addressee_id.eq.${userId1})`
    )
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ? mapFriendshipRow(data) : null }
}

// ============================================
// Leaderboard Queries
// ============================================

/**
 * Get global leaderboard for a format
 * Uses the get_leaderboard database function
 */
export async function getLeaderboard(
  client: SupabaseClient<Database>,
  formatId: string,
  limit = 10,
  collectionId?: string
): Promise<Result<LeaderboardEntry[]>> {
  const { data, error } = await client.rpc('get_leaderboard', {
    p_format_id: formatId,
    p_collection_id: collectionId,
    p_limit: limit,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Type cast since RPC returns generic JSON
  const entries = data as LeaderboardFunctionResult[]
  return { success: true, data: entries.map(mapLeaderboardEntry) }
}
