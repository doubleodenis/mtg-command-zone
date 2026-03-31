/**
 * Mock Data Factories
 *
 * Factory functions for generating test data during development.
 * Use overrides to customize specific fields for edge cases.
 *
 * @example
 * // Basic usage
 * createMockProfile()
 *
 * // With overrides
 * createMockMatch({ format: 'pentagram', isFullyConfirmed: false })
 */

// Re-export all utilities
export { generateMockDate, generateMockId, resetMockIds } from './utils'

// Re-export profile factories
export {
  createMockColorStats,
  createMockFormatStats,
  createMockLeaderboard,
  createMockLeaderboardEntry,
  createMockPlayerComparison,
  createMockPlayerStats,
  createMockProfile,
  createMockProfileSummary,
  createMockProfileWithStats,
} from './profile'

export type { ColorStats, CommanderVsRecord, FormatStatEntry, FormatVsRecord, PlayerComparisonData, RelationshipRecord } from './profile'

// Re-export deck factories
export {
  createMockDeck,
  createMockDeckStats,
  createMockDeckSummary,
  createMockDeckWithStats,
  createMockPlaceholderDeck,
} from './deck'

// Re-export friendship factories
export {
  createMockFriend,
  createMockFriendRequest,
  createMockFriendship,
} from './friendship'

// Re-export format factories
export {
  createAllMockFormats,
  createMockFormat,
  createMockFormatSummary,
} from './format'

// Re-export collection factories
export {
  createMockCollection,
  createMockCollectionActivities,
  createMockCollectionActivity,
  createMockCollectionMember,
  createMockCollectionMemberWithProfile,
  createMockCollectionSummary,
  createMockCollectionWithMembers,
} from './collection'

// Re-export match factories
export {
  createMockAllPlaceholderMatch,
  createMockCollectionMatches,
  createMockDashboardMatches,
  createMockMatch,
  createMockMatchCardData,
  createMockMatchData,
  createMockMatchParticipant,
  createMockMatchParticipantWithDetails,
  createMockMatchSummary,
  createMockMatchWithDetails,
  createMockMatchWithParticipants,
  createMockMixedBracketMatch,
  createMockParticipantData,
  createMockParticipantDisplayInfo,
  createMockPartiallyConfirmedMatch,
  createMockPendingConfirmation,
  createMockPendingConfirmations,
  createMockUserMatches,
} from './match'

// Re-export rating factories
export {
  createMockRating,
  createMockRatingDelta,
  createMockRatingHistory,
  createMockRatingHistoryEntry,
  createMockRatingTimeline,
  createMockRatingWithFormat,
} from './rating'

// ============================================
// Scenario Factories
// ============================================

import { createMockCollectionSummary } from './collection'
import { createMockDeckWithStats } from './deck'
import { createAllMockFormats } from './format'
import { createMockFriend } from './friendship'
import { createMockDashboardMatches } from './match'
import { createMockPlayerStats, createMockProfile } from './profile'
import { createMockRatingTimeline, createMockRatingWithFormat } from './rating'

/**
 * Create a complete mock scenario for testing dashboard views
 */
export function createMockDashboardData() {
  const currentUser = createMockProfile()
  const friends = Array.from({ length: 8 }, () => createMockFriend())
  const decks = Array.from({ length: 5 }, () =>
    createMockDeckWithStats({ ownerId: currentUser.id })
  )
  const collections = Array.from({ length: 3 }, () =>
    createMockCollectionSummary()
  )
  const recentMatches = createMockDashboardMatches()
  const ratingHistory = createMockRatingTimeline(30)
  const ratings = createAllMockFormats().map((format) =>
    createMockRatingWithFormat({
      userId: currentUser.id,
      formatId: format.id,
      formatName: format.name,
      formatSlug: format.slug,
      rating: 1000 + Math.floor(Math.random() * 300),
      matchesPlayed: Math.floor(Math.random() * 50),
    })
  )

  return {
    currentUser,
    friends,
    decks,
    collections,
    recentMatches,
    ratingHistory,
    ratings,
    stats: createMockPlayerStats(),
  }
}
