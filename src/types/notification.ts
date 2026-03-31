/**
 * Notification types
 */

import type { ISODateString, UUID } from './common'
import type { ProfileSummary } from './profile'

/**
 * Notification type enum
 */
export type NotificationType =
  | 'match_pending_confirmation'
  | 'match_confirmed'
  | 'match_disputed'
  | 'match_result_edited'
  | 'elo_milestone'
  | 'rank_changed'
  | 'collection_invite'
  | 'collection_match_added'
  | 'claim_available'
  | 'claim_accepted'
  | 'deck_retroactively_updated'
  | 'friend_request'
  | 'friend_accepted'

/**
 * Entity types that notifications can reference
 */
export type NotificationEntityType = 'match' | 'collection' | 'player' | 'deck'

/**
 * Base notification record (maps to notifications table)
 */
export type Notification = {
  id: UUID
  recipientId: UUID
  actorId: UUID | null
  type: NotificationType
  entityType: NotificationEntityType
  entityId: UUID
  data: NotificationData
  readAt: ISODateString | null
  seenAt: ISODateString | null
  dismissedAt: ISODateString | null
  expiresAt: ISODateString | null
  createdAt: ISODateString
}

/**
 * Notification with actor profile for display
 */
export type NotificationWithActor = Notification & {
  actor: ProfileSummary | null
}

// ============================================
// Notification Data Payloads (stored in jsonb)
// ============================================

/**
 * Union of all notification data payloads
 */
export type NotificationData =
  | MatchPendingConfirmationData
  | MatchConfirmedData
  | FriendRequestData
  | FriendAcceptedData
  | CollectionInviteData
  | ClaimAvailableData
  | ClaimAcceptedData
  | EloMilestoneData
  | RankChangedData
  | GenericNotificationData

/**
 * Match pending confirmation notification data
 */
export type MatchPendingConfirmationData = {
  match_id: UUID
  participant_id: UUID
  format_name: string
  format_slug: string
  played_at: ISODateString
  creator_username: string
  creator_avatar_url: string | null
  deck_name: string | null
  is_winner: boolean
}

/**
 * Match confirmed notification data
 */
export type MatchConfirmedData = {
  match_id: UUID
  format_name: string
  rating_delta: number
  new_rating: number
}

/**
 * Friend request notification data
 */
export type FriendRequestData = {
  friendship_id: UUID
  requester_id: UUID
  requester_username: string
  requester_avatar_url: string | null
}

/**
 * Friend accepted notification data
 */
export type FriendAcceptedData = {
  friendship_id: UUID
  addressee_id: UUID
  addressee_username: string
  addressee_avatar_url: string | null
}

/**
 * Collection invite notification data
 */
export type CollectionInviteData = {
  collection_id: UUID
  collection_name: string
  owner_id: UUID
  owner_username: string
  owner_avatar_url: string | null
  role: 'owner' | 'member'
}

/**
 * Claim available notification data (for match creator)
 */
export type ClaimAvailableData = {
  match_id: UUID
  participant_id: UUID
  claimant_id: UUID
  claimant_username: string
  claimant_avatar_url: string | null
  placeholder_name: string
  format_name: string
  played_at: ISODateString
}

/**
 * Claim accepted notification data
 */
export type ClaimAcceptedData = {
  match_id: UUID
  participant_id: UUID
  approver_username: string
  approver_avatar_url: string | null
  format_name: string
  played_at: ISODateString
  is_winner: boolean
}

/**
 * ELO milestone notification data
 */
export type EloMilestoneData = {
  format_id: UUID
  format_name: string
  milestone: number
  new_rating: number
}

/**
 * Rank changed notification data
 */
export type RankChangedData = {
  format_id: UUID
  format_name: string
  old_rank: number
  new_rank: number
  direction: 'up' | 'down'
}

/**
 * Generic notification data fallback
 */
export type GenericNotificationData = Record<string, unknown>

// ============================================
// Notification Display Helpers
// ============================================

/**
 * Get human-readable title for notification type
 */
export function getNotificationTitle(type: NotificationType): string {
  const titles: Record<NotificationType, string> = {
    match_pending_confirmation: 'Match Confirmation Required',
    match_confirmed: 'Match Confirmed',
    match_disputed: 'Match Disputed',
    match_result_edited: 'Match Result Edited',
    elo_milestone: 'Rating Milestone',
    rank_changed: 'Rank Changed',
    collection_invite: 'Collection Invitation',
    collection_match_added: 'Match Added to Collection',
    claim_available: 'Placeholder Claim Request',
    claim_accepted: 'Claim Approved',
    deck_retroactively_updated: 'Deck Updated',
    friend_request: 'Friend Request',
    friend_accepted: 'Friend Request Accepted',
  }
  return titles[type]
}

/**
 * Get URL path for notification click-through
 */
export function getNotificationUrl(notification: Notification): string {
  const { entityType, entityId, data } = notification

  switch (entityType) {
    case 'match':
      return `/match/${entityId}`
    case 'collection':
      return `/collections/${entityId}`
    case 'player':
      // For friend requests/accepts, link to the actor's profile
      if ('requester_username' in data) {
        return `/player/${(data as FriendRequestData).requester_username}`
      }
      if ('addressee_username' in data) {
        return `/player/${(data as FriendAcceptedData).addressee_username}`
      }
      return `/player/${entityId}`
    case 'deck':
      return `/decks/${entityId}`
    default:
      return '/'
  }
}

/**
 * TTL values for notification types (in days)
 */
export const NOTIFICATION_TTL: Record<NotificationType, number | null> = {
  match_pending_confirmation: 7,
  match_confirmed: 90,
  match_disputed: null, // never expires
  match_result_edited: 90,
  elo_milestone: null, // never expires
  rank_changed: 90,
  collection_invite: 14,
  collection_match_added: 90,
  claim_available: 30,
  claim_accepted: null, // never expires
  deck_retroactively_updated: 90,
  friend_request: 30,
  friend_accepted: 90,
}
