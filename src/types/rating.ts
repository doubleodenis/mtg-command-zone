/**
 * Rating types - ELO-style rating system
 */

import type { Bracket, ISODateString, UUID } from './common'

/**
 * Rating configuration constants
 */
export const RATING_CONFIG = {
  defaultRating: 1000,
  defaultBracket: 2 as Bracket,
  bracketExponent: 1.5,
  bracketCoefficient: 0.12,
  kFactorThresholds: [
    { maxMatches: 20, k: 32 },
    { maxMatches: 50, k: 24 },
    { maxMatches: Infinity, k: 16 },
  ],
} as const

/**
 * Current rating record (maps to ratings table)
 * Scoped to user + format, optionally collection
 */
export type Rating = {
  id: UUID
  userId: UUID
  formatId: UUID
  collectionId: UUID | null // null = global rating
  rating: number
  matchesPlayed: number
  updatedAt: ISODateString
}

/**
 * Rating with format info for display
 */
export type RatingWithFormat = Rating & {
  formatName: string
  formatSlug: string
}

/**
 * Rating history record (maps to rating_history table)
 * Immutable append-only log of every rating change
 */
export type RatingHistory = {
  id: UUID
  userId: UUID
  matchId: UUID
  formatId: UUID
  collectionId: UUID | null // null = global rating change
  ratingBefore: number
  ratingAfter: number
  delta: number
  playerBracket: Bracket
  opponentAvgRating: number
  opponentAvgBracket: number
  kFactor: number
  algorithmVersion: number
  createdAt: ISODateString
}

/**
 * Rating history entry for display in UI
 */
export type RatingHistoryEntry = RatingHistory & {
  matchDate: ISODateString
  isWin: boolean
  opponentCount: number
}

/**
 * Rating delta display info
 */
export type RatingDelta = {
  before: number
  after: number
  delta: number
  isPositive: boolean
}

/**
 * Inputs to the rating algorithm calculation
 * All values snapshotted at match time for recalculation
 */
export type RatingCalculationInput = {
  playerId: UUID
  playerRating: number
  playerBracket: Bracket
  playerMatchCount: number
  isWinner: boolean
  opponents: Array<{
    rating: number
    bracket: Bracket
  }>
  formatId: UUID
  collectionId: UUID | null
}

/**
 * Output of the rating algorithm calculation
 */
export type RatingCalculationResult = {
  playerId: UUID
  ratingBefore: number
  ratingAfter: number
  delta: number
  expectedScore: number
  actualScore: number
  kFactor: number
  bracketModifier: number
  opponentAvgRating: number
  opponentAvgBracket: number
}

/**
 * Get K factor based on number of confirmed matches
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
 * Calculate bracket modifier based on bracket gap
 * gap = avg_opponent_bracket - player_bracket
 * modifier = 1 + sign(gap) * |gap|^1.5 * 0.12
 */
export function calculateBracketModifier(playerBracket: Bracket, opponentAvgBracket: number): number {
  const gap = opponentAvgBracket - playerBracket
  const sign = gap >= 0 ? 1 : -1
  return 1 + sign * Math.pow(Math.abs(gap), RATING_CONFIG.bracketExponent) * RATING_CONFIG.bracketCoefficient
}

/**
 * Calculate expected score (probability of winning)
 * Expected = player_rating_factor / sum(all_rating_factors)
 * where rating_factor = 10 ^ (rating / 400)
 */
export function calculateExpectedScore(playerRating: number, allRatings: number[]): number {
  const ratingFactor = (rating: number) => Math.pow(10, rating / 400)
  const playerFactor = ratingFactor(playerRating)
  const totalFactor = allRatings.reduce((sum, r) => sum + ratingFactor(r), 0)
  return playerFactor / totalFactor
}
