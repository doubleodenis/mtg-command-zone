/**
 * Friendship types (maps to friends table)
 */

import type { ISODateString, UUID } from './common'
import type { ProfileSummary } from './profile'

/**
 * Friendship status
 */
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'

/**
 * Friendship record (maps to friends table)
 */
export type Friendship = {
  id: UUID
  requesterId: UUID
  addresseeId: UUID
  status: FriendshipStatus
  createdAt: ISODateString
}

/**
 * Friendship with expanded user profiles
 */
export type FriendshipWithProfiles = Friendship & {
  requester: ProfileSummary
  addressee: ProfileSummary
}

/**
 * Friend list item (the "other" user in an accepted friendship)
 */
export type Friend = ProfileSummary & {
  friendshipId: UUID
  friendsSince: ISODateString
}

/**
 * Incoming friend request for display
 */
export type FriendRequest = {
  id: UUID
  from: ProfileSummary
  createdAt: ISODateString
}

/**
 * Outgoing friend request for display
 */
export type OutgoingFriendRequest = {
  id: UUID
  to: ProfileSummary
  createdAt: ISODateString
}

/**
 * Payload for sending a friend request
 */
export type SendFriendRequestPayload = {
  addresseeId: UUID
}

/**
 * Payload for responding to a friend request
 */
export type FriendRequestResponsePayload = {
  status: 'accepted' | 'blocked'
}
