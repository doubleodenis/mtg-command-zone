/**
 * Mock Profile Factories
 */

import type {
  LeaderboardEntry,
  PlayerStats,
  Profile,
  ProfileSummary,
  ProfileWithStats,
} from '@/types'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Mock Data
// ============================================

const MOCK_USERNAMES = [
  'arcane_mage',
  'dragon_slayer',
  'planeswalker99',
  'mtg_master',
  'commander_chad',
  'spell_slinger',
  'mana_dork',
  'counter_magic',
  'token_maker',
  'combo_player',
]

const MOCK_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
]

// ============================================
// Factory Functions
// ============================================

export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  const id = overrides.id ?? generateMockId()
  // Use random selection instead of deterministic to ensure fresh data on each render
  const randomIndex = Math.floor(Math.random() * MOCK_USERNAMES.length)

  return {
    id,
    username: MOCK_USERNAMES[randomIndex],
    avatarUrl: MOCK_AVATARS[randomIndex % MOCK_AVATARS.length],
    createdAt: generateMockDate(90),
    ...overrides,
  }
}

export function createMockProfileSummary(
  overrides: Partial<ProfileSummary> = {}
): ProfileSummary {
  const profile = createMockProfile(overrides)
  return {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
  }
}

export function createMockPlayerStats(
  overrides: Partial<PlayerStats> = {}
): PlayerStats {
  const totalMatches = overrides.totalMatches ?? 50
  const wins = overrides.wins ?? Math.floor(totalMatches * 0.45)
  const losses = totalMatches - wins

  return {
    totalMatches,
    wins,
    losses,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    currentStreak: 2,
    longestWinStreak: 7,
    ...overrides,
  }
}

export function createMockProfileWithStats(
  overrides: Partial<ProfileWithStats> = {}
): ProfileWithStats {
  return {
    ...createMockProfile(overrides),
    stats: createMockPlayerStats(overrides.stats),
    ...overrides,
  }
}

export function createMockLeaderboardEntry(
  rank: number,
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry {
  const profile = createMockProfileSummary(overrides)
  return {
    ...profile,
    rating: 1200 - (rank - 1) * 25,
    matchesPlayed: 50 + Math.floor(Math.random() * 100),
    wins: 25 + Math.floor(Math.random() * 50),
    winRate: 45 + Math.floor(Math.random() * 20),
    rank,
    ...overrides,
  }
}

/**
 * Create a leaderboard with rankings
 */
export function createMockLeaderboard(size = 10): LeaderboardEntry[] {
  return Array.from({ length: size }, (_, i) =>
    createMockLeaderboardEntry(i + 1)
  )
}

/**
 * Color stats for radar chart (games played with each color)
 */
export type ColorStats = {
  W: number
  U: number
  B: number
  R: number
  G: number
}

/**
 * Create mock color stats based on commander color distribution
 */
export function createMockColorStats(): ColorStats {
  return {
    W: 15 + Math.floor(Math.random() * 30),
    U: 20 + Math.floor(Math.random() * 35),
    B: 25 + Math.floor(Math.random() * 30),
    R: 10 + Math.floor(Math.random() * 25),
    G: 18 + Math.floor(Math.random() * 28),
  }
}

/**
 * Format-specific stats
 */
export type FormatStatEntry = {
  formatSlug: string
  formatName: string
  matchesPlayed: number
  wins: number
  winRate: number
  rating: number
}

/**
 * Create mock format stats
 */
export function createMockFormatStats(): FormatStatEntry[] {
  const formats = [
    { slug: 'ffa', name: 'FFA' },
    { slug: '1v1', name: '1v1' },
    { slug: '2v2', name: '2v2' },
    { slug: '3v3', name: '3v3' },
    { slug: 'pentagram', name: 'Pentagram' },
  ]

  return formats.map((format) => {
    const matchesPlayed = 5 + Math.floor(Math.random() * 40)
    const wins = Math.floor(matchesPlayed * (0.3 + Math.random() * 0.4))
    return {
      formatSlug: format.slug,
      formatName: format.name,
      matchesPlayed,
      wins,
      winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
      rating: 900 + Math.floor(Math.random() * 400),
    }
  }).sort((a, b) => b.matchesPlayed - a.matchesPlayed)
}
