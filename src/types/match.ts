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
 * Participant confirmation status
 */
export type ParticipantStatus = 'pending' | 'confirmed' | 'auto_confirmed'

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
  /** When the match becomes locked and ratings are applied */
  locksAt: ISODateString
  /** Whether the match needs rating recalculation due to post-lock edits */
  isDirty: boolean
  /** When the nightly recalc job last processed this match */
  lastRecalculatedAt: ISODateString | null
  /** When ratings were applied to the ratings table (null = still in lock window) */
  ratingsAppliedAt: ISODateString | null
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
  /** Confirmation status: pending, confirmed (manual), or auto_confirmed (lock window expired) */
  participantStatus: ParticipantStatus
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
  /** Confirmation status: pending, confirmed, or auto_confirmed */
  participantStatus: ParticipantStatus
  deck: DeckSummary | null
  team: string | null
  isWinner: boolean
  ratingDelta: RatingDelta | null // null if not confirmed
  participantData: ParticipantData | null // format-specific metadata
  claimStatus: ClaimStatus // 'none' | 'pending' | 'approved' | 'rejected'
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
  /** When the match becomes locked */
  locksAt: ISODateString
  /** Whether the lock window has expired */
  isLocked: boolean
  /** Whether ratings have been applied to the ratings table */
  ratingsApplied: boolean
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

// ============================================
// Match Invite Token Types
// ============================================

/**
 * Match invite token record (maps to match_invite_tokens table)
 */
export type MatchInviteToken = {
  id: UUID
  matchId: UUID
  participantId: UUID | null // Optional: link to specific placeholder
  token: string
  createdBy: UUID
  createdAt: ISODateString
  expiresAt: ISODateString
  usedAt: ISODateString | null
  usedBy: UUID | null
}

/**
 * Invite token with match details for display
 */
export type MatchInviteTokenWithDetails = MatchInviteToken & {
  match: MatchSummary
  placeholderSlots: Array<{
    participantId: UUID
    placeholderName: string
    claimStatus: ClaimStatus
  }>
}

/**
 * Payload for creating an invite token
 */
export type CreateInviteTokenPayload = {
  matchId: UUID
  participantId?: UUID // Optional: link to specific participant
}

/**
 * Result of validating an invite token
 */
export type ValidateInviteTokenResult = {
  isValid: boolean
  isExpired: boolean
  isUsed: boolean
  match: MatchSummary | null
  placeholderSlots: Array<{
    participantId: UUID
    placeholderName: string
    claimStatus: ClaimStatus
  }>
}
