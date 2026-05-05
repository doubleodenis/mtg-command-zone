/**
 * Dirty Match Recalculation Tests
 * 
 * Tests to verify that rating recalculation correctly handles bracket changes
 * when a user changes their deck in a match after ratings have been applied.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateRating,
  calculateBracketModifier,
  ALGORITHM_VERSION,
} from '@/lib/rating'
import type { Bracket } from '@/types/common'

// ============================================
// Bracket Change Impact Tests
// ============================================

describe('Bracket change impact on ratings', () => {
  // Standard test scenario: 4-player game, player rating 1000, opponents all 1000
  const baseScenario = {
    playerId: 'test-user' as const,
    playerRating: 1000,
    playerMatchCount: 10,
    formatId: 'test-format',
    collectionId: null,
    opponents: [
      { rating: 1000, bracket: 2 as Bracket },
      { rating: 1000, bracket: 2 as Bracket },
      { rating: 1000, bracket: 2 as Bracket },
    ],
  }

  describe('Winner with bracket change', () => {
    it('calculates different deltas for different brackets', () => {
      // Win with bracket 1 deck (weak deck vs stronger opponents)
      const bracket1Win = calculateRating({
        ...baseScenario,
        playerBracket: 1 as Bracket,
        isWinner: true,
      })

      // Win with bracket 2 deck (equal brackets)
      const bracket2Win = calculateRating({
        ...baseScenario,
        playerBracket: 2 as Bracket,
        isWinner: true,
      })

      // Win with bracket 4 deck (strong deck vs weaker opponents)
      const bracket4Win = calculateRating({
        ...baseScenario,
        playerBracket: 4 as Bracket,
        isWinner: true,
      })

      // All should be positive (winner)
      expect(bracket1Win.delta).toBeGreaterThan(0)
      expect(bracket2Win.delta).toBeGreaterThan(0)
      expect(bracket4Win.delta).toBeGreaterThan(0)

      // Bracket 1 should get MOST points (underdog bonus)
      expect(bracket1Win.delta).toBeGreaterThan(bracket2Win.delta)
      
      // Bracket 4 should get LEAST points (expected to win)
      expect(bracket4Win.delta).toBeLessThan(bracket2Win.delta)

      // Verify bracket modifiers align
      expect(bracket1Win.bracketModifier).toBeGreaterThan(1)
      expect(bracket2Win.bracketModifier).toBe(1)
      expect(bracket4Win.bracketModifier).toBeLessThan(1)
    })

    it('returns significantly different delta when changing from bracket 1 to bracket 4', () => {
      const bracket1Result = calculateRating({
        ...baseScenario,
        playerBracket: 1 as Bracket,
        isWinner: true,
      })

      const bracket4Result = calculateRating({
        ...baseScenario,
        playerBracket: 4 as Bracket,
        isWinner: true,
      })

      // Delta difference should be significant (not just a few points)
      const deltaDifference = bracket1Result.delta - bracket4Result.delta
      expect(deltaDifference).toBeGreaterThan(3) // At least 3 rating points difference
      
      console.log(`[TEST] Winner delta comparison:`)
      console.log(`  Bracket 1: +${bracket1Result.delta} (modifier: ${bracket1Result.bracketModifier.toFixed(3)})`)
      console.log(`  Bracket 4: +${bracket4Result.delta} (modifier: ${bracket4Result.bracketModifier.toFixed(3)})`)
      console.log(`  Difference: ${deltaDifference} points`)
    })
  })

  describe('Loser with bracket change', () => {
    it('calculates different deltas for different brackets when losing', () => {
      // Loss with bracket 1 deck (weak deck)
      const bracket1Loss = calculateRating({
        ...baseScenario,
        playerBracket: 1 as Bracket,
        isWinner: false,
      })

      // Loss with bracket 2 deck (equal brackets)
      const bracket2Loss = calculateRating({
        ...baseScenario,
        playerBracket: 2 as Bracket,
        isWinner: false,
      })

      // Loss with bracket 4 deck (strong deck)
      const bracket4Loss = calculateRating({
        ...baseScenario,
        playerBracket: 4 as Bracket,
        isWinner: false,
      })

      // All should be negative (loser)
      expect(bracket1Loss.delta).toBeLessThan(0)
      expect(bracket2Loss.delta).toBeLessThan(0)
      expect(bracket4Loss.delta).toBeLessThan(0)

      // NOTE: The bracket modifier amplifies the delta in BOTH directions
      // This means a weak deck (modifier > 1) loses MORE points on a loss
      // And a strong deck (modifier < 1) loses FEWER points on a loss
      // This creates incentive to accurately report deck power levels
      
      // Bracket 1 (modifier > 1) amplifies the negative delta = loses MORE
      expect(Math.abs(bracket1Loss.delta)).toBeGreaterThan(Math.abs(bracket2Loss.delta))
      
      // Bracket 4 (modifier < 1) reduces the negative delta = loses LESS  
      expect(Math.abs(bracket4Loss.delta)).toBeLessThan(Math.abs(bracket2Loss.delta))

      console.log(`[TEST] Loser delta comparison:`)
      console.log(`  Bracket 1: ${bracket1Loss.delta} (modifier: ${bracket1Loss.bracketModifier.toFixed(3)})`)
      console.log(`  Bracket 2: ${bracket2Loss.delta} (modifier: ${bracket2Loss.bracketModifier.toFixed(3)})`)
      console.log(`  Bracket 4: ${bracket4Loss.delta} (modifier: ${bracket4Loss.bracketModifier.toFixed(3)})`)
    })
  })

  describe('Simulated deck change scenario', () => {
    it('simulates changing deck from bracket 1 to bracket 4 after match', () => {
      // User played with bracket 1 deck and won
      // Original rating history shows: delta = +X with bracket 1 modifier

      // Later, they realize they picked wrong deck - actually used bracket 4
      // After recalculation, delta should be smaller because bracket 4 was "expected" to win

      const originalCalc = calculateRating({
        ...baseScenario,
        playerBracket: 1 as Bracket, // Original: thought they used weak deck
        isWinner: true,
      })

      const correctedCalc = calculateRating({
        ...baseScenario,
        playerBracket: 4 as Bracket, // Corrected: actually used strong deck
        isWinner: true,
      })

      const deltaChange = correctedCalc.delta - originalCalc.delta

      // Delta should DECREASE (they get less points now that we know they used a strong deck)
      expect(deltaChange).toBeLessThan(0)
      expect(correctedCalc.delta).toBeLessThan(originalCalc.delta)

      console.log(`[TEST] Deck change simulation (bracket 1 → 4):`)
      console.log(`  Original delta (bracket 1): +${originalCalc.delta}`)
      console.log(`  Corrected delta (bracket 4): +${correctedCalc.delta}`)
      console.log(`  Delta change: ${deltaChange} (should be negative)`)
      console.log(`  Rating adjustment needed: ${deltaChange} points`)
    })

    it('simulates changing deck from bracket 4 to bracket 1 after match', () => {
      // User played with bracket 4 deck and won (or so they recorded)
      // Actually used bracket 1 deck - deserves MORE points

      const originalCalc = calculateRating({
        ...baseScenario,
        playerBracket: 4 as Bracket, // Original: thought they used strong deck
        isWinner: true,
      })

      const correctedCalc = calculateRating({
        ...baseScenario,
        playerBracket: 1 as Bracket, // Corrected: actually used weak deck
        isWinner: true,
      })

      const deltaChange = correctedCalc.delta - originalCalc.delta

      // Delta should INCREASE (they get more points now that we know they used a weak deck)
      expect(deltaChange).toBeGreaterThan(0)
      expect(correctedCalc.delta).toBeGreaterThan(originalCalc.delta)

      console.log(`[TEST] Deck change simulation (bracket 4 → 1):`)
      console.log(`  Original delta (bracket 4): +${originalCalc.delta}`)
      console.log(`  Corrected delta (bracket 1): +${correctedCalc.delta}`)
      console.log(`  Delta change: +${deltaChange} (should be positive)`)
    })
  })
})

// ============================================
// Bracket Modifier Edge Cases
// ============================================

describe('Bracket modifier calculations', () => {
  it('handles all valid bracket combinations', () => {
    const brackets: Bracket[] = [1, 2, 3, 4]
    
    for (const playerBracket of brackets) {
      for (const oppBracket of [1, 2, 3, 4]) {
        const modifier = calculateBracketModifier(playerBracket, oppBracket)
        expect(modifier).toBeGreaterThan(0) // Should always be positive
        expect(modifier).toBeLessThan(3) // Should be reasonable (not exploding)
      }
    }
  })

  it('is symmetric around equal brackets', () => {
    // Playing up should be symmetric to playing down
    const playingUp = calculateBracketModifier(1 as Bracket, 3) // gap = +2
    const playingDown = calculateBracketModifier(3 as Bracket, 1) // gap = -2

    // Distance from 1 should be equal
    expect(Math.abs(playingUp - 1)).toBeCloseTo(Math.abs(playingDown - 1), 2)
  })

  it('provides meaningful bonus/penalty for 1 bracket difference', () => {
    const modifier = calculateBracketModifier(2 as Bracket, 3) // gap = 1
    const bonus = modifier - 1
    
    // 12% bonus/penalty for 1 bracket gap
    expect(bonus).toBeCloseTo(0.12, 2)
  })
})

// ============================================
// Recalculation Correctness
// ============================================

describe('Recalculation produces consistent results', () => {
  it('produces same result when called multiple times with same inputs', () => {
    const input = {
      playerId: 'test-user',
      playerRating: 1050,
      playerBracket: 3 as Bracket,
      playerMatchCount: 25,
      isWinner: true,
      opponents: [
        { rating: 980, bracket: 2 as Bracket },
        { rating: 1020, bracket: 3 as Bracket },
        { rating: 1100, bracket: 4 as Bracket },
      ],
      formatId: 'test-format',
      collectionId: null,
    }

    const result1 = calculateRating(input)
    const result2 = calculateRating(input)
    const result3 = calculateRating(input)

    expect(result1.delta).toBe(result2.delta)
    expect(result2.delta).toBe(result3.delta)
    expect(result1.bracketModifier).toBe(result2.bracketModifier)
    expect(result1.expectedScore).toBe(result2.expectedScore)
  })

  it('uses current algorithm version', () => {
    expect(ALGORITHM_VERSION).toBe(1)
  })

  it('includes all required calculation outputs', () => {
    const result = calculateRating({
      playerId: 'test-user',
      playerRating: 1000,
      playerBracket: 2 as Bracket,
      playerMatchCount: 10,
      isWinner: true,
      opponents: [{ rating: 1000, bracket: 2 as Bracket }],
      formatId: 'test-format',
      collectionId: null,
    })

    // All required fields for rating_history should be present
    expect(result).toHaveProperty('delta')
    expect(result).toHaveProperty('ratingBefore')
    expect(result).toHaveProperty('ratingAfter')
    expect(result).toHaveProperty('expectedScore')
    expect(result).toHaveProperty('kFactor')
    expect(result).toHaveProperty('bracketModifier')
    expect(result).toHaveProperty('opponentAvgRating')
    expect(result).toHaveProperty('opponentAvgBracket')

    // Types should be correct
    expect(typeof result.delta).toBe('number')
    expect(typeof result.kFactor).toBe('number')
    expect(typeof result.bracketModifier).toBe('number')
  })
})

// ============================================
// Real-world Scenario Tests
// ============================================

describe('Real-world deck change scenarios', () => {
  it('EDH: Player selects cEDH deck but actually played precon', () => {
    // Common mistake: selecting the wrong deck from a similar name
    // Selected: "Elenda cEDH" (bracket 4)
    // Actual: "Elenda Precon" (bracket 1)

    const opponents = [
      { rating: 1100, bracket: 2 as Bracket },
      { rating: 1050, bracket: 2 as Bracket },
      { rating: 980, bracket: 2 as Bracket },
    ]

    const wrongDeckResult = calculateRating({
      playerId: 'player',
      playerRating: 1000,
      playerBracket: 4 as Bracket, // Wrong - cEDH
      playerMatchCount: 15,
      isWinner: true,
      opponents,
      formatId: 'edh',
      collectionId: null,
    })

    const correctDeckResult = calculateRating({
      playerId: 'player',
      playerRating: 1000,
      playerBracket: 1 as Bracket, // Correct - Precon
      playerMatchCount: 15,
      isWinner: true,
      opponents,
      formatId: 'edh',
      collectionId: null,
    })

    // They should get significantly more points with the precon
    expect(correctDeckResult.delta).toBeGreaterThan(wrongDeckResult.delta)
    
    const pointsDifference = correctDeckResult.delta - wrongDeckResult.delta
    expect(pointsDifference).toBeGreaterThan(2)

    console.log(`[TEST] Real-world scenario - wrong deck selection:`)
    console.log(`  With cEDH (bracket 4): +${wrongDeckResult.delta}`)
    console.log(`  With Precon (bracket 1): +${correctDeckResult.delta}`)
    console.log(`  Points they were missing: ${pointsDifference}`)
  })

  it('handles mixed bracket opponents correctly', () => {
    const mixedOpponents = [
      { rating: 1000, bracket: 1 as Bracket }, // Precon
      { rating: 1000, bracket: 3 as Bracket }, // Upgraded
      { rating: 1000, bracket: 4 as Bracket }, // cEDH
    ]

    const result = calculateRating({
      playerId: 'player',
      playerRating: 1000,
      playerBracket: 2 as Bracket, // Casual
      playerMatchCount: 20,
      isWinner: true,
      opponents: mixedOpponents,
      formatId: 'edh',
      collectionId: null,
    })

    // Average opponent bracket = (1+3+4)/3 = 2.67
    // Player bracket = 2, so gap = +0.67 (slight underdog)
    expect(result.opponentAvgBracket).toBeCloseTo(2.67, 1)
    expect(result.bracketModifier).toBeGreaterThan(1) // Should get bonus

    console.log(`[TEST] Mixed bracket game:`)
    console.log(`  Opponent avg bracket: ${result.opponentAvgBracket.toFixed(2)}`)
    console.log(`  Bracket modifier: ${result.bracketModifier.toFixed(3)}`)
    console.log(`  Delta: +${result.delta}`)
  })
})
