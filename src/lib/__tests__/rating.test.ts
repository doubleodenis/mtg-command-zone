import { describe, it, expect } from 'vitest'
import {
  getKFactor,
  calculateExpectedScore,
  calculateBracketModifier,
  calculateOpponentAvgRating,
  calculateOpponentAvgBracket,
  calculateRating,
  calculateMatchRatings,
  formatRatingDelta,
  getRatingTier,
  ALGORITHM_VERSION,
} from '@/lib/rating'
import { RATING_CONFIG } from '@/types/rating'
import type { Bracket, UUID } from '@/types/common'

// ============================================
// K Factor Tests
// ============================================

describe('getKFactor', () => {
  it('returns 32 for calibration phase (0-20 matches)', () => {
    expect(getKFactor(0)).toBe(32)
    expect(getKFactor(10)).toBe(32)
    expect(getKFactor(20)).toBe(32)
  })

  it('returns 24 for intermediate phase (21-50 matches)', () => {
    expect(getKFactor(21)).toBe(24)
    expect(getKFactor(35)).toBe(24)
    expect(getKFactor(50)).toBe(24)
  })

  it('returns 16 for veteran phase (51+ matches)', () => {
    expect(getKFactor(51)).toBe(16)
    expect(getKFactor(100)).toBe(16)
    expect(getKFactor(1000)).toBe(16)
  })
})

// ============================================
// Expected Score Tests
// ============================================

describe('calculateExpectedScore', () => {
  it('returns ~0.5 for equally rated 1v1', () => {
    const expected = calculateExpectedScore(1000, [1000, 1000])
    expect(expected).toBeCloseTo(0.5, 2)
  })

  it('returns higher expected score for higher rated player', () => {
    const higherRated = calculateExpectedScore(1200, [1200, 1000])
    const lowerRated = calculateExpectedScore(1000, [1200, 1000])
    expect(higherRated).toBeGreaterThan(lowerRated)
    expect(higherRated).toBeGreaterThan(0.5)
    expect(lowerRated).toBeLessThan(0.5)
  })

  it('returns ~0.25 for equal 4-player FFA', () => {
    const expected = calculateExpectedScore(1000, [1000, 1000, 1000, 1000])
    expect(expected).toBeCloseTo(0.25, 2)
  })

  it('returns higher expected for favored player in multiplayer', () => {
    // 1200 rated player vs three 1000 rated players
    const favored = calculateExpectedScore(1200, [1200, 1000, 1000, 1000])
    expect(favored).toBeGreaterThan(0.25)
  })

  it('handles large rating differences', () => {
    // Very high rated player vs low rated
    const veryFavored = calculateExpectedScore(1500, [1500, 800])
    expect(veryFavored).toBeGreaterThan(0.9)
  })
})

// ============================================
// Bracket Modifier Tests
// ============================================

describe('calculateBracketModifier', () => {
  it('returns 1 when brackets are equal', () => {
    const modifier = calculateBracketModifier(2 as Bracket, 2)
    expect(modifier).toBe(1)
  })

  it('returns >1 when playing against stronger decks (positive gap)', () => {
    // Player bracket 1 vs opponent avg bracket 3 (gap = +2)
    const modifier = calculateBracketModifier(1 as Bracket, 3)
    expect(modifier).toBeGreaterThan(1)
  })

  it('returns <1 when playing against weaker decks (negative gap)', () => {
    // Player bracket 4 vs opponent avg bracket 2 (gap = -2)
    const modifier = calculateBracketModifier(4 as Bracket, 2)
    expect(modifier).toBeLessThan(1)
  })

  it('applies nonlinear scaling (exponent 1.5)', () => {
    const gap1 = calculateBracketModifier(1 as Bracket, 2) // gap = 1
    const gap2 = calculateBracketModifier(1 as Bracket, 3) // gap = 2

    // gap2 bonus should be more than 2x gap1 bonus due to ^1.5
    const bonus1 = gap1 - 1
    const bonus2 = gap2 - 1
    expect(bonus2 / bonus1).toBeGreaterThan(2)
  })

  it('uses correct coefficient (0.12)', () => {
    // Gap of 1 should give modifier = 1 + 1^1.5 * 0.12 = 1.12
    const modifier = calculateBracketModifier(2 as Bracket, 3)
    expect(modifier).toBeCloseTo(1.12, 2)
  })
})

// ============================================
// Opponent Average Tests
// ============================================

describe('calculateOpponentAvgRating', () => {
  it('returns default rating for empty opponents', () => {
    expect(calculateOpponentAvgRating([])).toBe(RATING_CONFIG.defaultRating)
  })

  it('calculates average correctly', () => {
    const opponents = [{ rating: 1000 }, { rating: 1200 }, { rating: 1100 }]
    expect(calculateOpponentAvgRating(opponents)).toBeCloseTo(1100, 2)
  })

  it('handles single opponent', () => {
    expect(calculateOpponentAvgRating([{ rating: 1500 }])).toBe(1500)
  })
})

describe('calculateOpponentAvgBracket', () => {
  it('returns default bracket for empty opponents', () => {
    expect(calculateOpponentAvgBracket([])).toBe(RATING_CONFIG.defaultBracket)
  })

  it('calculates average correctly', () => {
    const opponents = [
      { bracket: 1 as Bracket },
      { bracket: 3 as Bracket },
      { bracket: 2 as Bracket },
    ]
    expect(calculateOpponentAvgBracket(opponents)).toBe(2)
  })
})

// ============================================
// Full Rating Calculation Tests
// ============================================

describe('calculateRating', () => {
  const makeUUID = (n: number): UUID => `uuid-${n}` as UUID

  it('calculates positive delta for a win', () => {
    const result = calculateRating({
      playerId: makeUUID(1),
      playerRating: 1000,
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
      formatId: makeUUID(100),
      collectionId: null,
    })

    expect(result.delta).toBeGreaterThan(0)
    expect(result.ratingAfter).toBeGreaterThan(result.ratingBefore)
    expect(result.actualScore).toBe(1)
    expect(result.kFactor).toBe(32) // calibration phase
  })

  it('calculates negative delta for a loss', () => {
    const result = calculateRating({
      playerId: makeUUID(1),
      playerRating: 1000,
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      isWinner: false,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
      formatId: makeUUID(100),
      collectionId: null,
    })

    expect(result.delta).toBeLessThan(0)
    expect(result.ratingAfter).toBeLessThan(result.ratingBefore)
    expect(result.actualScore).toBe(0)
  })

  it('calculates zero-sum for 1v1 with equal ratings', () => {
    const baseInput = {
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      formatId: makeUUID(100),
      collectionId: null,
    }

    const winner = calculateRating({
      ...baseInput,
      playerId: makeUUID(1),
      playerRating: 1000,
      isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
    })

    const loser = calculateRating({
      ...baseInput,
      playerId: makeUUID(2),
      playerRating: 1000,
      isWinner: false,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
    })

    // In 1v1 with equal ratings, winner gets +K/2 and loser gets -K/2
    expect(winner.delta).toBe(-loser.delta)
  })

  it('gives smaller gain when favored player wins', () => {
    const baseInput = {
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      formatId: makeUUID(100),
      collectionId: null,
    }

    const favoredWin = calculateRating({
      ...baseInput,
      playerId: makeUUID(1),
      playerRating: 1200,
      isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
    })

    const underdogWin = calculateRating({
      ...baseInput,
      playerId: makeUUID(2),
      playerRating: 1000,
      isWinner: true,
      opponents: [{ rating: 1200, bracket: 2 as Bracket }],
    })

    // Underdog should gain more for upsetting the favorite
    expect(underdogWin.delta).toBeGreaterThan(favoredWin.delta)
  })

  it('uses veteran K factor for experienced players', () => {
    const result = calculateRating({
      playerId: makeUUID(1),
      playerRating: 1000,
      playerBracket: 2 as Bracket,
      playerMatchCount: 100, // veteran
      isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
      formatId: makeUUID(100),
      collectionId: null,
    })

    expect(result.kFactor).toBe(16)
  })

  it('applies bracket modifier for power differential', () => {
    const baseInput = {
      playerId: makeUUID(1),
      playerRating: 1000,
      playerMatchCount: 10,
      isWinner: true,
      formatId: makeUUID(100),
      collectionId: null,
    }

    const weakDeckWin = calculateRating({
      ...baseInput,
      playerBracket: 1 as Bracket, // playing weak deck
      opponents: [{ rating: 1000, bracket: 4 as Bracket }], // vs strong deck
    })

    const equalDeckWin = calculateRating({
      ...baseInput,
      playerBracket: 2 as Bracket,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
    })

    // Win with weak deck vs strong deck should give bonus
    expect(weakDeckWin.bracketModifier).toBeGreaterThan(1)
    expect(weakDeckWin.delta).toBeGreaterThan(equalDeckWin.delta)
  })

  it('handles multiplayer FFA correctly', () => {
    const result = calculateRating({
      playerId: makeUUID(1),
      playerRating: 1000,
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      isWinner: true,
      opponents: [
        { rating: 1000, bracket: 2 as Bracket },
        { rating: 1000, bracket: 2 as Bracket },
        { rating: 1000, bracket: 2 as Bracket },
      ],
      formatId: makeUUID(100),
      collectionId: null,
    })

    // Expected score is 0.25 in 4-player FFA, so win gains more
    expect(result.expectedScore).toBeCloseTo(0.25, 2)
    // Delta should be ~K * (1 - 0.25) = K * 0.75
    expect(result.delta).toBeGreaterThan(20) // K=32, so ~24
  })
})

// ============================================
// Batch Match Rating Tests
// ============================================

describe('calculateMatchRatings', () => {
  const makeUUID = (n: number): UUID => `uuid-${n}` as UUID

  it('calculates ratings for all participants', () => {
    const results = calculateMatchRatings({
      matchId: makeUUID(1),
      formatId: makeUUID(100),
      collectionIds: [],
      participants: [
        {
          participantId: makeUUID(1),
          userId: makeUUID(10),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: true,
        },
        {
          participantId: makeUUID(2),
          userId: makeUUID(20),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: false,
        },
      ],
    })

    expect(results).toHaveLength(2)
    expect(results[0].userId).toBe(makeUUID(10))
    expect(results[1].userId).toBe(makeUUID(20))
  })

  it('includes collection-scoped ratings when collections provided', () => {
    const results = calculateMatchRatings({
      matchId: makeUUID(1),
      formatId: makeUUID(100),
      collectionIds: [makeUUID(200), makeUUID(201)],
      participants: [
        {
          participantId: makeUUID(1),
          userId: makeUUID(10),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: true,
        },
        {
          participantId: makeUUID(2),
          userId: makeUUID(20),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: false,
        },
      ],
    })

    expect(results[0].collections).toHaveLength(2)
    expect(results[0].collections[0].collectionId).toBe(makeUUID(200))
    expect(results[0].collections[1].collectionId).toBe(makeUUID(201))
  })

  it('winner gains points while losers lose points in FFA', () => {
    const results = calculateMatchRatings({
      matchId: makeUUID(1),
      formatId: makeUUID(100),
      collectionIds: [],
      participants: [
        {
          participantId: makeUUID(1),
          userId: makeUUID(10),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: true,
        },
        {
          participantId: makeUUID(2),
          userId: makeUUID(20),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: false,
        },
        {
          participantId: makeUUID(3),
          userId: makeUUID(30),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: false,
        },
        {
          participantId: makeUUID(4),
          userId: makeUUID(40),
          rating: 1000,
          bracket: 2 as Bracket,
          matchCount: 10,
          isWinner: false,
        },
      ],
    })

    const [winner, ...losers] = results
    expect(winner.global.delta).toBeGreaterThan(0)
    losers.forEach((loser) => {
      expect(loser.global.delta).toBeLessThan(0)
    })
  })
})

// ============================================
// Utility Function Tests
// ============================================

describe('formatRatingDelta', () => {
  it('formats positive delta with plus sign', () => {
    expect(formatRatingDelta(12)).toBe('+12')
  })

  it('formats negative delta with proper minus sign', () => {
    const result = formatRatingDelta(-8)
    expect(result).toBe('−8') // U+2212 minus sign, not hyphen
    expect(result).not.toBe('-8') // Should not use hyphen
  })

  it('formats zero without sign', () => {
    expect(formatRatingDelta(0)).toBe('0')
  })
})

describe('getRatingTier', () => {
  it('returns Bronze for ratings below 800', () => {
    expect(getRatingTier(500)).toBe('Bronze')
    expect(getRatingTier(799)).toBe('Bronze')
  })

  it('returns Silver for ratings 800-999', () => {
    expect(getRatingTier(800)).toBe('Silver')
    expect(getRatingTier(999)).toBe('Silver')
  })

  it('returns Gold for ratings 1000-1199', () => {
    expect(getRatingTier(1000)).toBe('Gold')
    expect(getRatingTier(1199)).toBe('Gold')
  })

  it('returns Diamond for ratings 1200-1399', () => {
    expect(getRatingTier(1200)).toBe('Diamond')
    expect(getRatingTier(1399)).toBe('Diamond')
  })

  it('returns Mythic for ratings 1400+', () => {
    expect(getRatingTier(1400)).toBe('Mythic')
    expect(getRatingTier(2000)).toBe('Mythic')
  })
})

// ============================================
// Algorithm Version Tests
// ============================================

describe('ALGORITHM_VERSION', () => {
  it('should be defined', () => {
    expect(ALGORITHM_VERSION).toBeDefined()
    expect(typeof ALGORITHM_VERSION).toBe('number')
  })
})
