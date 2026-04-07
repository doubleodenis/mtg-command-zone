/**
 * Profile types for user accounts
 */

import type { ISODateString, UUID } from './common'

/**
 * User profile data (maps to profiles table)
 */
export type Profile = {
  id: UUID
  username: string
  avatarUrl: string | null
  createdAt: ISODateString
}

/**
 * Profile for display in lists, cards, and compact views
 */
export type ProfileSummary = Pick<Profile, 'id' | 'username' | 'avatarUrl'>

/**
 * Profile with aggregated stats
 */
export type ProfileWithStats = Profile & {
  stats: PlayerStats
}

/**
 * Player statistics (derived from matches)
 */
export type PlayerStats = {
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  currentStreak: number
  longestWinStreak: number
}

/**
 * Player stats scoped to a specific format
 */
export type FormatStats = PlayerStats & {
  formatId: UUID
  formatName: string
}

/**
 * Profile update payload
 */
export type ProfileUpdatePayload = {
  username?: string
  avatarUrl?: string | null
}

/**
 * Leaderboard entry with ranking data
 */
export type LeaderboardEntry = ProfileSummary & {
  rating: number
  matchesPlayed: number
  wins: number
  winRate: number
  rank: number
  formatSlug?: string // Optional format identifier for filtering
}
