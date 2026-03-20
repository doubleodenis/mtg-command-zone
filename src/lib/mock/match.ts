/**
 * Mock Match Factories
 */

import type {
  Bracket,
  FormatSlug,
  Match,
  MatchCardData,
  MatchData,
  MatchParticipant,
  MatchParticipantWithDetails,
  MatchSummary,
  MatchWithDetails,
  MatchWithParticipants,
  ParticipantData,
  ParticipantDisplayInfo,
} from '@/types'
import { createMockDeckSummary } from './deck'
import { createMockFormatSummary } from './format'
import { createMockProfileSummary } from './profile'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Match Data Factories
// ============================================

export function createMockMatchData(formatSlug: FormatSlug = 'ffa'): MatchData {
  switch (formatSlug) {
    case '1v1':
      return { format: '1v1' }
    case 'ffa':
      return { format: 'ffa' }
    case '2v2':
      return { format: '2v2', teams: { A: {}, B: {} } }
    case '3v3':
      return { format: '3v3', teams: { A: {}, B: {} } }
    case 'pentagram':
      return {
        format: 'pentagram',
        seatingOrder: [
          generateMockId(),
          generateMockId(),
          generateMockId(),
          generateMockId(),
          generateMockId(),
        ],
      }
  }
}

export function createMockParticipantData(
  formatSlug: FormatSlug = 'ffa',
  options: { seatPosition?: number; teamId?: string } = {}
): ParticipantData {
  switch (formatSlug) {
    case '1v1':
      return { format: '1v1' }
    case 'ffa':
      return { format: 'ffa' }
    case '2v2':
      return { format: '2v2', teamId: options.teamId ?? 'A' }
    case '3v3':
      return { format: '3v3', teamId: options.teamId ?? 'A' }
    case 'pentagram': {
      const seat = options.seatPosition ?? 0
      return {
        format: 'pentagram',
        seatPosition: seat as 0 | 1 | 2 | 3 | 4,
        targetParticipantIds: [generateMockId(), generateMockId()],
        allyParticipantIds: [generateMockId(), generateMockId()],
      }
    }
  }
}

// ============================================
// Match Factories
// ============================================

export function createMockMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: generateMockId(),
    createdBy: generateMockId(),
    formatId: generateMockId(),
    playedAt: generateMockDate(7),
    notes: null,
    matchData: createMockMatchData('ffa'),
    createdAt: generateMockDate(7),
    ...overrides,
  }
}

export function createMockMatchParticipant(
  overrides: Partial<MatchParticipant> = {}
): MatchParticipant {
  return {
    id: generateMockId(),
    matchId: generateMockId(),
    userId: overrides.placeholderName ? null : generateMockId(),
    placeholderName: null,
    deckId: generateMockId(),
    team: null,
    isWinner: false,
    confirmedAt: generateMockDate(7),
    claimedBy: null,
    claimStatus: 'none',
    participantData: createMockParticipantData('ffa'),
    createdAt: generateMockDate(7),
    ...overrides,
  }
}

export function createMockMatchParticipantWithDetails(
  overrides: Partial<MatchParticipantWithDetails> = {}
): MatchParticipantWithDetails {
  const participant = createMockMatchParticipant(overrides)
  return {
    ...participant,
    profile: participant.userId
      ? createMockProfileSummary({ id: participant.userId })
      : null,
    deck: participant.deckId
      ? createMockDeckSummary({ id: participant.deckId })
      : null,
    claimant: participant.claimedBy
      ? createMockProfileSummary({ id: participant.claimedBy })
      : null,
    ...overrides,
  }
}

export function createMockParticipantDisplayInfo(
  overrides: Partial<ParticipantDisplayInfo> = {}
): ParticipantDisplayInfo {
  const profile = createMockProfileSummary()
  return {
    id: generateMockId(),
    name: profile.username,
    avatarUrl: profile.avatarUrl,
    isRegistered: true,
    isConfirmed: true,
    deck: createMockDeckSummary(),
    team: null,
    isWinner: false,
    ratingDelta: { before: 1000, after: 1012, delta: 12, isPositive: true },
    ...overrides,
  }
}

export function createMockMatchWithDetails(
  overrides: Partial<MatchWithDetails> = {}
): MatchWithDetails {
  const match = createMockMatch(overrides)
  return {
    ...match,
    format: createMockFormatSummary('ffa'),
    creator: createMockProfileSummary({ id: match.createdBy }),
    ...overrides,
  }
}

export function createMockMatchWithParticipants(
  participantCount = 4,
  options: {
    formatSlug?: FormatSlug
    fullyConfirmed?: boolean
    hasPlaceholder?: boolean
    winnerIndex?: number
  } = {}
): MatchWithParticipants {
  const {
    formatSlug = 'ffa',
    fullyConfirmed = true,
    hasPlaceholder = false,
    winnerIndex = 0,
  } = options

  const matchId = generateMockId()
  const creatorId = generateMockId()
  const format = createMockFormatSummary(formatSlug)

  const participants: MatchParticipantWithDetails[] = Array.from(
    { length: participantCount },
    (_, i) => {
      const isPlaceholder = hasPlaceholder && i === participantCount - 1
      const isWinner = i === winnerIndex
      const isConfirmed = fullyConfirmed || i === 0 // Creator always confirmed

      return createMockMatchParticipantWithDetails({
        matchId,
        userId: isPlaceholder ? null : generateMockId(),
        placeholderName: isPlaceholder ? 'Guest Player' : null,
        isWinner,
        confirmedAt: isConfirmed ? generateMockDate(7) : null,
        participantData: createMockParticipantData(formatSlug),
      })
    }
  )

  return {
    id: matchId,
    createdBy: creatorId,
    formatId: format.id,
    playedAt: generateMockDate(7),
    notes: null,
    matchData: createMockMatchData(formatSlug),
    createdAt: generateMockDate(7),
    format,
    creator: createMockProfileSummary({ id: creatorId }),
    participants,
  }
}

export function createMockMatchSummary(
  overrides: Partial<MatchSummary> = {}
): MatchSummary {
  return {
    id: generateMockId(),
    formatName: 'Free For All',
    formatSlug: 'ffa',
    playedAt: generateMockDate(7),
    participantCount: 4,
    confirmedCount: 4,
    winnerNames: ['arcane_mage'],
    isFullyConfirmed: true,
    ...overrides,
  }
}

export function createMockMatchCardData(
  participantCount = 4,
  overrides: Partial<MatchCardData> = {}
): MatchCardData {
  const participants = Array.from({ length: participantCount }, (_, i) =>
    createMockParticipantDisplayInfo({ isWinner: i === 0 })
  )

  return {
    ...createMockMatchSummary(),
    participants,
    userParticipant: participants[0],
    ...overrides,
  }
}

// ============================================
// Edge Case Factories
// ============================================

/**
 * Create edge case: partially confirmed match
 */
export function createMockPartiallyConfirmedMatch(): MatchWithParticipants {
  return createMockMatchWithParticipants(4, {
    fullyConfirmed: false,
    winnerIndex: 0,
  })
}

/**
 * Create edge case: match with all placeholders (except creator)
 */
export function createMockAllPlaceholderMatch(): MatchWithParticipants {
  const match = createMockMatchWithParticipants(4)

  // Convert all but first participant to placeholders
  match.participants = match.participants.map((p, i) => ({
    ...p,
    userId: i === 0 ? p.userId : null,
    placeholderName: i === 0 ? null : `Guest ${i}`,
    profile: i === 0 ? p.profile : null,
    confirmedAt: i === 0 ? p.confirmedAt : null,
  }))

  return match
}

/**
 * Create edge case: mixed bracket table
 */
export function createMockMixedBracketMatch(): MatchWithParticipants {
  const match = createMockMatchWithParticipants(4)
  const brackets: Bracket[] = [1, 2, 3, 4]

  match.participants = match.participants.map((p, i) => ({
    ...p,
    deck: p.deck ? { ...p.deck, bracket: brackets[i] } : null,
  }))

  return match
}
