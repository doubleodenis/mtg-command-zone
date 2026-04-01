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
  ParticipantDataPentagram,
  ParticipantDisplayInfo,
  PendingConfirmation,
} from '@/types'
import { getPentagramEnemies, PENTAGRAM_ADJACENCY_MAP } from '@/types'
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
    userId: profile.id,
    name: profile.username,
    avatarUrl: profile.avatarUrl,
    isRegistered: true,
    isConfirmed: true,
    deck: createMockDeckSummary(),
    team: null,
    isWinner: false,
    ratingDelta: { before: 1000, after: 1012, delta: 12, isPositive: true },
    participantData: null,
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
  const winnerIndex = Math.floor(Math.random() * participantCount);
  const participants = Array.from({ length: participantCount }, (_, i) =>
    createMockParticipantDisplayInfo({ isWinner: i === winnerIndex })
  )

  return {
    ...createMockMatchSummary({ participantCount }),
    participants,
    userParticipant: null, // Default to no user participant for global view
    ...overrides,
  }
}

/**
 * Create a set of varied mock matches for dashboard display
 */
/**
 * Get team assignment for a participant based on format and index
 */
function getTeamForParticipant(
  format: FormatSlug,
  index: number,
  playerCount: number
): string | null {
  switch (format) {
    case '1v1':
      return index === 0 ? 'A' : 'B'
    case '2v2':
      return index < 2 ? 'A' : 'B'
    case '3v3':
      return index < 3 ? 'A' : 'B'
    default:
      return null
  }
}

/**
 * Check if a format is a team format
 */
export function isTeamFormat(formatSlug: FormatSlug): boolean {
  return formatSlug === '1v1' || formatSlug === '2v2' || formatSlug === '3v3'
}

/**
 * Create Pentagram participant data for all 5 players given their IDs
 */
function createPentagramParticipantData(
  participantIds: [string, string, string, string, string]
): ParticipantDataPentagram[] {
  return participantIds.map((_, seatPosition) => {
    const allies = PENTAGRAM_ADJACENCY_MAP[seatPosition]
    const enemies = getPentagramEnemies(seatPosition)
    
    return {
      format: 'pentagram' as const,
      seatPosition: seatPosition as 0 | 1 | 2 | 3 | 4,
      targetParticipantIds: [
        participantIds[enemies[0]],
        participantIds[enemies[1]],
      ] as [string, string],
      allyParticipantIds: [
        participantIds[allies[0]],
        participantIds[allies[1]],
      ] as [string, string],
    }
  })
}

/**
 * Get participant data based on format
 */
function getParticipantDataForFormat(
  format: FormatSlug,
  index: number,
  participantIds?: string[]
): ParticipantData | null {
  switch (format) {
    case 'pentagram':
      if (participantIds && participantIds.length === 5) {
        const pentagramData = createPentagramParticipantData(
          participantIds as [string, string, string, string, string]
        )
        return pentagramData[index]
      }
      return null
    case '1v1':
      return { format: '1v1' }
    case 'ffa':
      return { format: 'ffa' }
    case '2v2':
      return { format: '2v2', teamId: index < 2 ? 'A' : 'B' }
    case '3v3':
      return { format: '3v3', teamId: index < 3 ? 'A' : 'B' }
    default:
      return null
  }
}

export function createMockDashboardMatches(): MatchCardData[] {
  // Mix of different player counts and formats
  // Player counts must match format requirements:
  // - 1v1: 2 players
  // - ffa: 3-6 players
  // - 2v2: 4 players
  // - 3v3: 6 players
  // - pentagram: 5 players
  const configs: Array<{ count: number; format: FormatSlug; formatName: string; bracket: Bracket }> = [
    { count: 4, format: 'ffa', formatName: 'Free For All', bracket: 2 },
    { count: 5, format: 'pentagram', formatName: 'Pentagram', bracket: 3 },
    { count: 2, format: '1v1', formatName: '1v1', bracket: 2 },
    { count: 4, format: '2v2', formatName: '2v2', bracket: 1 },
    { count: 6, format: '3v3', formatName: '3v3', bracket: 4 },
  ];

  return configs.map((config) => {
    // Randomize winner for each match
    const winningTeam = Math.random() < 0.5 ? 'A' : 'B'
    const winnerIndex = Math.floor(Math.random() * config.count)
    
    // Pre-generate participant IDs for Pentagram enemy/ally mapping
    const participantIds = Array.from({ length: config.count }, () => generateMockId())
    
    const participants = Array.from({ length: config.count }, (_, i) => {
      const team = getTeamForParticipant(config.format, i, config.count)
      const isWinner = isTeamFormat(config.format)
        ? team === winningTeam
        : i === winnerIndex
      
      return createMockParticipantDisplayInfo({
        id: participantIds[i],
        isWinner,
        team,
        deck: createMockDeckSummary({
          bracket: config.bracket,
        }),
        participantData: getParticipantDataForFormat(config.format, i, participantIds),
      })
    });

    return {
      ...createMockMatchSummary({
        participantCount: config.count,
        formatSlug: config.format,
        formatName: config.formatName,
      }),
      participants,
      userParticipant: null,
    };
  });
}

/**
 * Create mock matches where the user participated (for personal dashboard)
 */
export function createMockUserMatches(userId: string): MatchCardData[] {
  const configs: Array<{
    count: number
    format: FormatSlug
    formatName: string
    bracket: Bracket
  }> = [
    { count: 4, format: 'ffa', formatName: 'Free For All', bracket: 2 },
    { count: 5, format: 'pentagram', formatName: 'Pentagram', bracket: 3 },
    { count: 4, format: '2v2', formatName: '2v2', bracket: 2 },
    { count: 6, format: '3v3', formatName: '3v3', bracket: 2 },
    { count: 2, format: '1v1', formatName: '1v1', bracket: 4 },
  ];

  return configs.map((config) => {
    const userIndex = 0; // User is always first
    const hasTeams = isTeamFormat(config.format);
    
    // Randomize whether user wins
    const userWon = Math.random() < 0.5;
    const delta = userWon 
      ? Math.floor(Math.random() * 20) + 5  // +5 to +24
      : -(Math.floor(Math.random() * 15) + 3); // -3 to -17
    
    // For team formats, user is on team A. Winning team depends on userWon
    const winningTeam = userWon ? 'A' : 'B';
    // For FFA/pentagram, pick random winner index (0 = user wins, other = user loses)
    const winnerIndex = userWon ? userIndex : Math.floor(Math.random() * (config.count - 1)) + 1;
    
    // Pre-generate participant IDs (user is always first)
    const participantIds = [userId, ...Array.from({ length: config.count - 1 }, () => generateMockId())]

    const participants = Array.from({ length: config.count }, (_, i) => {
      const isUser = i === userIndex;
      const team = getTeamForParticipant(config.format, i, config.count);
      const isWinner = hasTeams
        ? team === winningTeam
        : i === winnerIndex;

      return createMockParticipantDisplayInfo({
        id: participantIds[i],
        isWinner,
        team,
        deck: createMockDeckSummary({ bracket: config.bracket }),
        ratingDelta: isUser
          ? {
              before: 1000,
              after: 1000 + delta,
              delta: delta,
              isPositive: delta > 0,
            }
          : null,
        participantData: getParticipantDataForFormat(config.format, i, participantIds),
      });
    });

    const userParticipant = participants[userIndex];

    return {
      ...createMockMatchSummary({
        participantCount: config.count,
        formatSlug: config.format,
        formatName: config.formatName,
        winnerNames: [participants.find(p => p.isWinner)?.name ?? ''],
      }),
      participants,
      userParticipant,
    };
  });
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

// ============================================
// Pending Confirmation Factories
// ============================================

/**
 * Create mock pending confirmation
 */
export function createMockPendingConfirmation(
  overrides: Partial<PendingConfirmation> = {}
): PendingConfirmation {
  return {
    matchId: generateMockId(),
    participantId: generateMockId(),
    match: createMockMatchSummary({ isFullyConfirmed: false }),
    createdAt: generateMockDate(1),
    hasDeckAssigned: true,
    ...overrides,
  }
}

/**
 * Create multiple mock pending confirmations with variety
 */
export function createMockPendingConfirmations(count = 3): PendingConfirmation[] {
  const formats: Array<{ slug: FormatSlug; name: string; count: number }> = [
    { slug: 'ffa', name: 'Free For All', count: 4 },
    { slug: 'pentagram', name: 'Pentagram', count: 5 },
    { slug: '1v1', name: '1v1', count: 2 },
  ]

  return Array.from({ length: count }, (_, i) => {
    const format = formats[i % formats.length]
    return createMockPendingConfirmation({
      match: createMockMatchSummary({
        formatSlug: format.slug,
        formatName: format.name,
        participantCount: format.count,
        confirmedCount: format.count - 1 - (i % 2), // Varying confirmation status
        isFullyConfirmed: false,
      }),
    })
  })
}

// ============================================
// Collection Match Factories
// ============================================

/**
 * Create mock matches for a collection (no user-specific data)
 * Generates a variety of matches across formats and dates
 */
export function createMockCollectionMatches(count = 10): MatchCardData[] {
  const configs: Array<{
    format: FormatSlug
    formatName: string
    participantCount: number
    bracket: Bracket
  }> = [
    { format: 'ffa', formatName: 'Free For All', participantCount: 4, bracket: 2 },
    { format: 'pentagram', formatName: 'Pentagram', participantCount: 5, bracket: 3 },
    { format: '2v2', formatName: '2v2', participantCount: 4, bracket: 2 },
    { format: '3v3', formatName: '3v3', participantCount: 6, bracket: 2 },
    { format: '1v1', formatName: '1v1', participantCount: 2, bracket: 4 },
  ]

  return Array.from({ length: count }, (_, i) => {
    const config = configs[i % configs.length]
    const hasTeams = isTeamFormat(config.format)
    
    // Randomize winner
    const winnerIndex = Math.floor(Math.random() * config.participantCount)
    const winningTeam = Math.random() > 0.5 ? 'A' : 'B'
    
    // Pre-generate participant IDs
    const participantIds = Array.from({ length: config.participantCount }, () => generateMockId())

    const participants = Array.from({ length: config.participantCount }, (_, j) => {
      const team = getTeamForParticipant(config.format, j, config.participantCount)
      const isWinner = hasTeams
        ? team === winningTeam
        : j === winnerIndex

      return createMockParticipantDisplayInfo({
        id: participantIds[j],
        isWinner,
        team,
        deck: createMockDeckSummary({ bracket: config.bracket }),
        ratingDelta: null, // No user-specific rating in collection view
        participantData: getParticipantDataForFormat(config.format, j, participantIds),
      })
    })

    // Stagger dates - more recent matches first
    const daysAgo = Math.floor(i * 1.5) // 0, 1, 3, 4, 6, 7, 9...

    return {
      ...createMockMatchSummary({
        participantCount: config.participantCount,
        formatSlug: config.format,
        formatName: config.formatName,
        winnerNames: [participants.find(p => p.isWinner)?.name ?? ''],
        playedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
      }),
      participants,
      userParticipant: null, // No specific user context
    }
  })
}
