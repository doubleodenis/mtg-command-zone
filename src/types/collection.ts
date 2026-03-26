/**
 * Collection types - named groups of matches
 */

import type { ISODateString, UUID } from './common'
import type { ProfileSummary } from './profile'

/**
 * Permission level for adding matches to a collection
 */
export type MatchAddPermission = 'owner_only' | 'any_member' | 'any_member_approval_required'

/**
 * Role within a collection
 */
export type CollectionRole = 'owner' | 'member'

/**
 * Approval status for matches in collections requiring approval
 */
export type ApprovalStatus = 'approved' | 'pending' | 'rejected'

/**
 * Collection record (maps to collections table)
 */
export type Collection = {
  id: UUID
  ownerId: UUID
  name: string
  description: string | null
  isPublic: boolean
  matchAddPermission: MatchAddPermission
  createdAt: ISODateString
}

/**
 * Collection with owner profile
 */
export type CollectionWithOwner = Collection & {
  owner: ProfileSummary
}

/**
 * Collection summary for lists and cards
 */
export type CollectionSummary = Pick<Collection, 'id' | 'name' | 'description' | 'isPublic'> & {
  memberCount: number
  matchCount: number
}

/**
 * Collection member record (maps to collection_members table)
 */
export type CollectionMember = {
  id: UUID
  collectionId: UUID
  userId: UUID
  role: CollectionRole
  joinedAt: ISODateString
}

/**
 * Collection member with profile data
 */
export type CollectionMemberWithProfile = CollectionMember & {
  profile: ProfileSummary
}

/**
 * Full collection details with members
 */
export type CollectionWithMembers = CollectionWithOwner & {
  members: CollectionMemberWithProfile[]
}

/**
 * Collection with user's membership status
 */
export type CollectionWithMembership = Collection & {
  isMember: boolean
  userRole: CollectionRole | null
  memberCount: number
  matchCount: number
}

/**
 * Collection match join record (maps to collection_matches table)
 */
export type CollectionMatch = {
  id: UUID
  collectionId: UUID
  matchId: UUID
  addedBy: UUID
  approvalStatus: ApprovalStatus
  addedAt: ISODateString
}

/**
 * Payload for creating a new collection
 */
export type CreateCollectionPayload = {
  name: string
  description?: string | null
  isPublic?: boolean
  matchAddPermission?: MatchAddPermission
}

/**
 * Payload for updating a collection
 */
export type UpdateCollectionPayload = {
  name?: string
  description?: string | null
  isPublic?: boolean
  matchAddPermission?: MatchAddPermission
}

/**
 * Payload for inviting a member to a collection
 */
export type InviteCollectionMemberPayload = {
  userId: UUID
}

/**
 * Payload for adding a match to a collection
 */
export type AddMatchToCollectionPayload = {
  matchId: UUID
}

/**
 * Payload for responding to a match approval request
 */
export type MatchApprovalResponsePayload = {
  approvalStatus: 'approved' | 'rejected'
}

/**
 * User's activity within a collection
 */
export type CollectionActivity = {
  collection: CollectionSummary
  userStats: {
    gamesPlayed: number
    wins: number
    winRate: number
    rating: number
    ratingDelta: number
  }
  topPlayer?: {
    profile: ProfileSummary
    winRate: number
    gamesPlayed: number
  }
}
