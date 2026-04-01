/**
 * Match and participant types
 */

import type { ISODateString, UUID } from './common'
import type { DeckSummary } from './deck'
import type { FormatSlug, FormatSummary, MatchData, ParticipantData } from './format'
import type { ProfileSummary } from './profile'
import type { RatingDelta } from './rating'

/**
 * Claim status for placeholder participants
 */
export type ClaimStatus = 'none' | 'pending' | 'approved' | 'rejected'

/**
 * Match record (maps to matches table)
 */
export type Match = {
  id: UUID
  createdBy: UUID
  formatId: UUID
  playedAt: ISODateString
  notes: string | null
  matchData: MatchData
  createdAt: ISODateString
}

/**
 * Match with format and creator info
 */
export type MatchWithDetails = Match & {
  format: FormatSummary
  creator: ProfileSummary
}

/**
 * Match participant record (maps to match_participants table)
 */
export type MatchParticipant = {
  id: UUID
  matchId: UUID
  userId: UUID | null // null for placeholder
  placeholderName: string | null // used when userId is null
  deckId: UUID | null
  team: string | null
  isWinner: boolean
  confirmedAt: ISODateString | null // null = unconfirmed
  claimedBy: UUID | null
  claimStatus: ClaimStatus
  participantData: ParticipantData
  createdAt: ISODateString
}

/**
 * Match participant with related data
 */
export type MatchParticipantWithDetails = MatchParticipant & {
  profile: ProfileSummary | null // null for placeholder
  deck: DeckSummary | null
  claimant: ProfileSummary | null // user who claimed this slot
}

/**
 * Display info for any participant (registered or placeholder)
 */
export type ParticipantDisplayInfo = {
  id: UUID
  userId: UUID | null // null for placeholder participants
  name: string
  avatarUrl: string | null
  isRegistered: boolean
  isConfirmed: boolean
  deck: DeckSummary | null
  team: string | null
  isWinner: boolean
  ratingDelta: RatingDelta | null // null if not confirmed
  participantData: ParticipantData | null // format-specific metadata
}

/**
 * Full match details with all participants
 */
export type MatchWithParticipants = MatchWithDetails & {
  participants: MatchParticipantWithDetails[]
}

/**
 * Match summary for lists and cards
 */
export type MatchSummary = {
  id: UUID
  formatName: string
  formatSlug: FormatSlug
  playedAt: ISODateString
  participantCount: number
  confirmedCount: number
  winnerNames: string[]
  isFullyConfirmed: boolean
}

/**
 * Match card display data
 */
export type MatchCardData = MatchSummary & {
  participants: ParticipantDisplayInfo[]
  userParticipant: ParticipantDisplayInfo | null // current user's slot if participating
}

// ============================================
// Match Creation Types
// ============================================

/**
 * Participant input during match creation (registered user)
 */
export type RegisteredParticipantInput = {
  type: 'registered'
  userId: UUID
  deckId: UUID | null
  team?: string | null
}

/**
 * Participant input during match creation (placeholder/guest)
 */
export type PlaceholderParticipantInput = {
  type: 'placeholder'
  placeholderName: string
  team?: string | null
}

/**
 * Union type for participant inputs
 */
export type ParticipantInput = RegisteredParticipantInput | PlaceholderParticipantInput

/**
 * Payload for creating a new match
 */
export type CreateMatchPayload = {
  formatId: UUID
  playedAt?: ISODateString
  notes?: string | null
  matchData: MatchData
  participants: ParticipantInput[]
  winnerIndices: number[] // Indices in participants array who won
}

/**
 * Payload for confirming a match
 */
export type ConfirmMatchPayload = {
  matchId: UUID
  participantId: UUID
}

/**
 * Payload for claiming a placeholder slot
 */
export type ClaimParticipantPayload = {
  participantId: UUID
}

/**
 * Payload for responding to a claim request (match creator only)
 */
export type ClaimResponsePayload = {
  participantId: UUID
  status: 'approved' | 'rejected'
}

/**
 * Payload for updating a participant's deck (retroactive update)
 */
export type UpdateParticipantDeckPayload = {
  participantId: UUID
  deckId: UUID
}

// ============================================
// Match Filter/Query Types
// ============================================

/**
 * Filters for match queries
 */
export type MatchFilters = {
  formatId?: UUID
  userId?: UUID // matches involving this user
  collectionId?: UUID
  startDate?: ISODateString
  endDate?: ISODateString
  isFullyConfirmed?: boolean
  createdBy?: UUID
}

/**
 * Sort options for match queries
 */
export type MatchSortField = 'playedAt' | 'createdAt'

// ============================================
// Notification Types
// ============================================

/**
 * Pending confirmation for a user
 */
export type PendingConfirmation = {
  matchId: UUID
  participantId: UUID
  match: MatchSummary
  createdAt: ISODateString
  /** Whether this participant already has a deck assigned */
  hasDeckAssigned: boolean
}

/**
 * Pending claim request for match creator
 */
export type PendingClaimRequest = {
  matchId: UUID
  participantId: UUID
  claimant: ProfileSummary
  placeholderName: string
  match: MatchSummary
  createdAt: ISODateString
}

/**
 * Claimable match slot (for claim search page)
 */
export type ClaimableMatchSlot = {
  participantId: UUID
  matchId: UUID
  placeholderName: string
  match: {
    id: UUID
    playedAt: ISODateString
    formatSlug: FormatSlug
    formatName: string
    creatorUsername: string
    creatorDisplayName: string | null
    otherParticipants: string[] // Names of other players in the match
  }
}
