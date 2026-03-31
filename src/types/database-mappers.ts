/**
 * Database Mappers
 *
 * Converts between snake_case database types and camelCase application types.
 * Use these at the data access boundary — components should never receive raw DB types.
 */

import type { Tables, Enums } from './database.types'
import type { Bracket, ColorIdentity, ISODateString, UUID } from './common'
import type { Profile, ProfileSummary, LeaderboardEntry } from './profile'
import type { Deck, DeckSummary, DeckWithStats, DeckStats } from './deck'
import type { Friendship, FriendshipStatus, Friend, FriendRequest, OutgoingFriendRequest } from './friendship'
import type { Format, FormatSummary, FormatSlug, FormatConfig, WinConditionType } from './format'
import type { Match, MatchParticipant, MatchWithDetails, MatchParticipantWithDetails, ClaimStatus } from './match'
import type { Collection, CollectionMember, CollectionRole, MatchAddPermission, ApprovalStatus, CollectionSummary, CollectionMemberWithProfile } from './collection'
import type { Rating, RatingHistory, RatingWithFormat } from './rating'
import type { NotificationType, NotificationEntityType } from './notification'

// ============================================
// Type Aliases for Database Row Types
// ============================================

export type ProfileRow = Tables<'profiles'>
export type FriendRow = Tables<'friends'>
export type DeckRow = Tables<'decks'>
export type FormatRow = Tables<'formats'>
export type MatchRow = Tables<'matches'>
export type MatchParticipantRow = Tables<'match_participants'>
export type CollectionRow = Tables<'collections'>
export type CollectionMemberRow = Tables<'collection_members'>
export type CollectionMatchRow = Tables<'collection_matches'>
export type RatingRow = Tables<'ratings'>
export type RatingHistoryRow = Tables<'rating_history'>
export type NotificationRow = Tables<'notifications'>

// ============================================
// Enum Type Aliases
// ============================================

export type DbFriendshipStatus = Enums<'friendship_status'>
export type DbCollectionRole = Enums<'collection_role'>
export type DbMatchAddPermission = Enums<'match_add_permission'>
export type DbApprovalStatus = Enums<'approval_status'>
export type DbClaimStatus = Enums<'claim_status'>
export type DbWinConditionType = Enums<'win_condition_type'>
export type DbNotificationType = Enums<'notification_type'>
export type DbNotificationEntityType = Enums<'notification_entity_type'>

// ============================================
// Profile Mappers
// ============================================

export function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapProfileSummary(row: ProfileRow): ProfileSummary {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
  }
}

// ============================================
// Deck Mappers
// ============================================

export function mapDeckRow(row: DeckRow): Deck {
  return {
    id: row.id,
    ownerId: row.owner_id,
    commanderName: row.commander_name,
    partnerName: row.partner_name,
    deckName: row.deck_name,
    colorIdentity: row.color_identity as ColorIdentity,
    bracket: row.bracket as Bracket,
    isActive: row.is_active,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapDeckSummary(row: DeckRow): DeckSummary {
  return {
    id: row.id,
    commanderName: row.commander_name,
    partnerName: row.partner_name,
    deckName: row.deck_name,
    colorIdentity: row.color_identity as ColorIdentity,
    bracket: row.bracket as Bracket,
  }
}

export function mapDeckWithStats(row: DeckRow, stats: DeckStats): DeckWithStats {
  return {
    ...mapDeckRow(row),
    stats,
  }
}

// ============================================
// Friendship Mappers
// ============================================

export function mapFriendshipRow(row: FriendRow): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status as FriendshipStatus,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapFriendRow(row: FriendRow, otherProfile: ProfileRow, isRequester: boolean): Friend {
  return {
    id: otherProfile.id,
    username: otherProfile.username,
    avatarUrl: otherProfile.avatar_url,
    friendshipId: row.id,
    friendsSince: row.created_at ?? new Date().toISOString(),
  }
}

export function mapFriendRequest(row: FriendRow, requesterProfile: ProfileRow): FriendRequest {
  return {
    id: row.id,
    from: mapProfileSummary(requesterProfile),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapOutgoingFriendRequest(row: FriendRow, addresseeProfile: ProfileRow): OutgoingFriendRequest {
  return {
    id: row.id,
    to: mapProfileSummary(addresseeProfile),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

// ============================================
// Format Mappers
// ============================================

export function mapFormatRow(row: FormatRow): Format {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug as FormatSlug,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    hasTeams: row.has_teams,
    winConditionType: row.win_condition_type as WinConditionType,
    config: row.config as FormatConfig,
    isActive: row.is_active,
  }
}

export function mapFormatSummary(row: FormatRow): FormatSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug as FormatSlug,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    hasTeams: row.has_teams,
  }
}

// ============================================
// Match Mappers
// ============================================

export function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    createdBy: row.created_by,
    formatId: row.format_id,
    playedAt: row.played_at ?? new Date().toISOString(),
    notes: row.notes,
    matchData: row.match_data as Match['matchData'],
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapMatchWithDetails(
  row: MatchRow,
  format: FormatRow,
  creator: ProfileRow
): MatchWithDetails {
  return {
    ...mapMatchRow(row),
    format: mapFormatSummary(format),
    creator: mapProfileSummary(creator),
  }
}

export function mapMatchParticipantRow(row: MatchParticipantRow): MatchParticipant {
  return {
    id: row.id,
    matchId: row.match_id,
    userId: row.user_id,
    placeholderName: row.placeholder_name,
    deckId: row.deck_id,
    team: row.team,
    isWinner: row.is_winner,
    confirmedAt: row.confirmed_at,
    claimedBy: row.claimed_by,
    claimStatus: row.claim_status as ClaimStatus,
    participantData: row.participant_data as MatchParticipant['participantData'],
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapMatchParticipantWithDetails(
  row: MatchParticipantRow,
  profile: ProfileRow | null,
  deck: DeckRow | null,
  claimant: ProfileRow | null
): MatchParticipantWithDetails {
  return {
    ...mapMatchParticipantRow(row),
    profile: profile ? mapProfileSummary(profile) : null,
    deck: deck ? mapDeckSummary(deck) : null,
    claimant: claimant ? mapProfileSummary(claimant) : null,
  }
}

// ============================================
// Collection Mappers
// ============================================

export function mapCollectionRow(row: CollectionRow): Collection {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    matchAddPermission: row.match_add_permission as MatchAddPermission,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

export function mapCollectionSummary(
  row: CollectionRow,
  memberCount: number,
  matchCount: number
): CollectionSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    memberCount,
    matchCount,
  }
}

export function mapCollectionMemberRow(row: CollectionMemberRow): CollectionMember {
  return {
    id: row.id,
    collectionId: row.collection_id,
    userId: row.user_id,
    role: row.role as CollectionRole,
    joinedAt: row.joined_at ?? new Date().toISOString(),
  }
}

export function mapCollectionMemberWithProfile(
  row: CollectionMemberRow,
  profile: ProfileRow
): CollectionMemberWithProfile {
  return {
    ...mapCollectionMemberRow(row),
    profile: mapProfileSummary(profile),
  }
}

// ============================================
// Rating Mappers
// ============================================

export function mapRatingRow(row: RatingRow): Rating {
  return {
    id: row.id,
    userId: row.user_id,
    formatId: row.format_id,
    collectionId: row.collection_id,
    rating: row.rating,
    matchesPlayed: row.matches_played,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

export function mapRatingWithFormat(row: RatingRow, format: FormatRow): RatingWithFormat {
  return {
    ...mapRatingRow(row),
    formatName: format.name,
    formatSlug: format.slug,
  }
}

export function mapRatingHistoryRow(row: RatingHistoryRow): RatingHistory {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    formatId: row.format_id,
    collectionId: row.collection_id,
    ratingBefore: row.rating_before,
    ratingAfter: row.rating_after,
    delta: row.delta,
    playerBracket: row.player_bracket as Bracket,
    opponentAvgRating: row.opponent_avg_rating,
    opponentAvgBracket: row.opponent_avg_bracket,
    kFactor: row.k_factor,
    algorithmVersion: row.algorithm_version,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

// ============================================
// Leaderboard Mapper (from get_leaderboard function result)
// ============================================

export type LeaderboardFunctionResult = {
  user_id: string
  username: string
  avatar_url: string | null
  rating: number
  matches_played: number
  wins: number
  win_rate: number
  rank: number
}

export function mapLeaderboardEntry(row: LeaderboardFunctionResult): LeaderboardEntry {
  return {
    id: row.user_id,
    username: row.username,
    avatarUrl: row.avatar_url,
    rating: row.rating,
    matchesPlayed: row.matches_played,
    wins: row.wins,
    winRate: row.win_rate,
    rank: row.rank,
  }
}

// ============================================
// Notification Mapper
// ============================================

export function mapNotificationRow(row: NotificationRow) {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    type: row.type as NotificationType,
    entityType: row.entity_type as NotificationEntityType,
    entityId: row.entity_id,
    data: row.data as Record<string, unknown>,
    readAt: row.read_at,
    seenAt: row.seen_at,
    dismissedAt: row.dismissed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}
