/**
 * Mock Rating Factories
 */

import type {
  Bracket,
  Rating,
  RatingDelta,
  RatingHistory,
  RatingHistoryEntry,
  RatingWithFormat,
} from '@/types'
import { RATING_CONFIG } from '@/types/rating'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Factory Functions
// ============================================

export function createMockRating(overrides: Partial<Rating> = {}): Rating {
  return {
    id: generateMockId(),
    userId: generateMockId(),
    formatId: generateMockId(),
    collectionId: null,
    rating: RATING_CONFIG.defaultRating,
    matchesPlayed: 0,
    updatedAt: generateMockDate(0),
    ...overrides,
  }
}

export function createMockRatingWithFormat(
  overrides: Partial<RatingWithFormat> = {}
): RatingWithFormat {
  return {
    ...createMockRating(overrides),
    formatName: 'Free For All',
    formatSlug: 'ffa',
    ...overrides,
  }
}

export function createMockRatingHistory(
  overrides: Partial<RatingHistory> = {}
): RatingHistory {
  const ratingBefore = overrides.ratingBefore ?? 1000
  const delta = overrides.delta ?? 12

  return {
    id: generateMockId(),
    userId: generateMockId(),
    matchId: generateMockId(),
    formatId: generateMockId(),
    collectionId: null,
    ratingBefore,
    ratingAfter: ratingBefore + delta,
    delta,
    playerBracket: 2 as Bracket,
    opponentAvgRating: 1000,
    opponentAvgBracket: 2,
    kFactor: 32,
    algorithmVersion: 1,
    createdAt: generateMockDate(7),
    ...overrides,
  }
}

export function createMockRatingHistoryEntry(
  overrides: Partial<RatingHistoryEntry> = {}
): RatingHistoryEntry {
  const history = createMockRatingHistory(overrides)
  return {
    ...history,
    matchDate: generateMockDate(7),
    isWin: history.delta > 0,
    opponentCount: 3,
    ...overrides,
  }
}

export function createMockRatingDelta(
  overrides: Partial<RatingDelta> = {}
): RatingDelta {
  const delta = overrides.delta ?? 12
  const before = overrides.before ?? 1000

  return {
    before,
    after: before + delta,
    delta,
    isPositive: delta >= 0,
    ...overrides,
  }
}

/**
 * Create a rating history timeline for charting
 */
export function createMockRatingTimeline(
  points = 20,
  startRating = 1000
): RatingHistoryEntry[] {
  let currentRating = startRating

  return Array.from({ length: points }, (_, i) => {
    const isWin = Math.random() > 0.45
    const delta = isWin
      ? Math.floor(Math.random() * 20) + 5
      : -(Math.floor(Math.random() * 15) + 5)

    const entry = createMockRatingHistoryEntry({
      ratingBefore: currentRating,
      ratingAfter: currentRating + delta,
      delta,
      isWin,
      createdAt: generateMockDate(points - i),
      matchDate: generateMockDate(points - i),
    })

    currentRating += delta
    return entry
  })
}
