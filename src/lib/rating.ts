/**
 * Rating Algorithm — Pure Functions
 *
 * This module contains the complete rating calculation logic as pure functions
 * with no side effects. All inputs are explicit, making the algorithm fully
 * unit-testable and rerunnable for retroactive recalculation.
 *
 * Formula: Δ Rating = K × (Actual − Expected) × BracketModifier
 */

import type { Bracket, UUID } from '@/types/common'
import type {
  RatingCalculationInput,
  RatingCalculationResult,
} from '@/types/rating'
import { RATING_CONFIG } from '@/types/rating'

/**
 * Current algorithm version — increment when the formula changes
 * to maintain audit trail in rating_history
 */
export const ALGORITHM_VERSION = 1

// ============================================
// Core Calculation Functions
// ============================================

/**
 * Get K factor based on number of confirmed matches
 * K decreases as players accumulate matches, stabilizing veteran ratings
 *
 * 0-20 matches: K=32 (calibration phase)
 * 21-50 matches: K=24
 * 51+ matches: K=16 (veteran)
 */
export function getKFactor(matchesPlayed: number): number {
  for (const threshold of RATING_CONFIG.kFactorThresholds) {
    if (matchesPlayed <= threshold.maxMatches) {
      return threshold.k
    }
  }
  return RATING_CONFIG.kFactorThresholds[RATING_CONFIG.kFactorThresholds.length - 1].k
}

/**
 * Calculate expected score (probability of winning)
 * Uses the standard ELO logistic curve extended to N players
 *
 * Expected = player_rating_factor / sum(all_rating_factors)
 * where rating_factor = 10^(rating / 400)
 */
export function calculateExpectedScore(
  playerRating: number,
  allRatings: number[]
): number {
  const ratingFactor = (rating: number) => Math.pow(10, rating / 400)
  const playerFactor = ratingFactor(playerRating)
  const totalFactor = allRatings.reduce((sum, r) => sum + ratingFactor(r), 0)
  return playerFactor / totalFactor
}

/**
 * Calculate bracket modifier based on deck power level differential
 *
 * gap = avg_opponent_bracket - player_bracket
 * modifier = 1 + sign(gap) × |gap|^1.5 × 0.12
 *
 * Positive gap (playing weaker deck): bonus on win, reduced penalty on loss
 * Negative gap (playing stronger deck): reduced gain on win, penalty on loss
 */
export function calculateBracketModifier(
  playerBracket: Bracket,
  opponentAvgBracket: number
): number {
  const gap = opponentAvgBracket - playerBracket
  const sign = gap >= 0 ? 1 : -1
  return (
    1 +
    sign *
      Math.pow(Math.abs(gap), RATING_CONFIG.bracketExponent) *
      RATING_CONFIG.bracketCoefficient
  )
}

/**
 * Calculate the average rating of opponents
 */
export function calculateOpponentAvgRating(
  opponents: Array<{ rating: number }>
): number {
  if (opponents.length === 0) return RATING_CONFIG.defaultRating
  const sum = opponents.reduce((acc, o) => acc + o.rating, 0)
  return sum / opponents.length
}

/**
 * Calculate the average bracket of opponents
 */
export function calculateOpponentAvgBracket(
  opponents: Array<{ bracket: Bracket }>
): number {
  if (opponents.length === 0) return RATING_CONFIG.defaultBracket
  const sum = opponents.reduce((acc, o) => acc + o.bracket, 0)
  return sum / opponents.length
}

// ============================================
// Main Rating Calculation
// ============================================

/**
 * Calculate the rating change for a single player in a match
 *
 * This is the core rating algorithm implementation.
 * All inputs should be snapshotted at match time to ensure
 * consistent results during retroactive recalculation.
 *
 * Formula: Δ = K × (Actual - Expected) × BracketModifier
 */
export function calculateRating(
  input: RatingCalculationInput
): RatingCalculationResult {
  const {
    playerId,
    playerRating,
    playerBracket,
    playerMatchCount,
    isWinner,
    opponents,
  } = input

  // Actual score: 1 for win, 0 for loss
  const actualScore = isWinner ? 1 : 0

  // Collect all ratings at the table (player + opponents)
  const allRatings = [playerRating, ...opponents.map((o) => o.rating)]

  // Expected score based on ratings
  const expectedScore = calculateExpectedScore(playerRating, allRatings)

  // K factor based on experience level
  const kFactor = getKFactor(playerMatchCount)

  // Opponent averages for bracket modifier
  const opponentAvgRating = calculateOpponentAvgRating(opponents)
  const opponentAvgBracket = calculateOpponentAvgBracket(opponents)

  // Bracket modifier (deck power differential)
  const bracketModifier = calculateBracketModifier(playerBracket, opponentAvgBracket)

  // Final delta calculation
  const rawDelta = kFactor * (actualScore - expectedScore)
  const delta = Math.round(rawDelta * bracketModifier)

  return {
    playerId,
    ratingBefore: playerRating,
    ratingAfter: playerRating + delta,
    delta,
    expectedScore,
    actualScore,
    kFactor,
    bracketModifier,
    opponentAvgRating,
    opponentAvgBracket,
  }
}

// ============================================
// Batch Calculations
// ============================================

/**
 * Input for calculating ratings for all participants in a match
 */
export type MatchRatingInput = {
  matchId: UUID
  formatId: UUID
  collectionIds: UUID[] // All collections this match belongs to
  participants: Array<{
    participantId: UUID
    userId: UUID
    rating: number
    bracket: Bracket
    matchCount: number
    isWinner: boolean
  }>
}

/**
 * Output for a single participant's rating changes (global + per-collection)
 */
export type ParticipantRatingResults = {
  participantId: UUID
  userId: UUID
  global: RatingCalculationResult
  collections: Array<{
    collectionId: UUID
    result: RatingCalculationResult
  }>
}

/**
 * Calculate ratings for all participants in a match
 *
 * Returns rating changes for both global and all collection-scoped ratings.
 * A match in 3 collections triggers 4 rating calculations per player:
 * 1 global + 3 collection-scoped.
 */
export function calculateMatchRatings(
  input: MatchRatingInput
): ParticipantRatingResults[] {
  const { collectionIds, participants } = input

  return participants.map((participant) => {
    // Build opponent list (everyone except this participant)
    const opponents = participants
      .filter((p) => p.participantId !== participant.participantId)
      .map((p) => ({
        rating: p.rating,
        bracket: p.bracket,
      }))

    // Base input for this participant
    const baseInput: RatingCalculationInput = {
      playerId: participant.userId,
      playerRating: participant.rating,
      playerBracket: participant.bracket,
      playerMatchCount: participant.matchCount,
      isWinner: participant.isWinner,
      opponents,
      formatId: input.formatId,
      collectionId: null,
    }

    // Calculate global rating
    const globalResult = calculateRating(baseInput)

    // Calculate collection-scoped ratings
    // Note: In a real implementation, each collection might have different
    // rating/matchCount snapshots. For simplicity, we use the same inputs here.
    // The actual implementation would fetch collection-specific ratings.
    const collectionResults = collectionIds.map((collectionId) => ({
      collectionId,
      result: calculateRating({ ...baseInput, collectionId }),
    }))

    return {
      participantId: participant.participantId,
      userId: participant.userId,
      global: globalResult,
      collections: collectionResults,
    }
  })
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format a rating delta for display with sign
 * e.g., +12, −8 (uses proper minus sign, not hyphen)
 */
export function formatRatingDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `−${Math.abs(delta)}` // Using proper minus sign (U+2212)
  return '0'
}

/**
 * Get the rating tier label based on current rating
 */
export function getRatingTier(rating: number): string {
  if (rating >= 1400) return 'Mythic'
  if (rating >= 1200) return 'Diamond'
  if (rating >= 1000) return 'Gold'
  if (rating >= 800) return 'Silver'
  return 'Bronze'
}

/**
 * Calculate ordinal rank suffix (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * Estimate rating change before a match is played
 * Useful for showing potential gains/losses in match preview
 */
export function estimateRatingChange(
  playerRating: number,
  playerBracket: Bracket,
  playerMatchCount: number,
  opponentRatings: number[],
  opponentBrackets: Bracket[]
): { winDelta: number; lossDelta: number } {
  const opponents = opponentRatings.map((rating, i) => ({
    rating,
    bracket: opponentBrackets[i],
  }))

  const winResult = calculateRating({
    playerId: 'estimate',
    playerRating,
    playerBracket,
    playerMatchCount,
    isWinner: true,
    opponents,
    formatId: 'estimate',
    collectionId: null,
  })

  const loseResult = calculateRating({
    playerId: 'estimate',
    playerRating,
    playerBracket,
    playerMatchCount,
    isWinner: false,
    opponents,
    formatId: 'estimate',
    collectionId: null,
  })

  return {
    winDelta: winResult.delta,
    lossDelta: loseResult.delta,
  }
}