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
  'https://robohash.org/arcane_mage?set=set4&size=200x200',
  'https://robohash.org/dragon_slayer?set=set4&size=200x200',
  'https://robohash.org/planeswalker99?set=set4&size=200x200',
  'https://robohash.org/mtg_master?set=set4&size=200x200',
  'https://robohash.org/commander_chad?set=set4&size=200x200',
]

const MOCK_DISPLAY_NAMES = [
  'The Arcane Mage',
  'Dragon Slayer',
  'Planeswalker #99',
  'MTG Master',
  'Commander Chad',
  'Spell Slinger',
  null, // Some users have no display name
  null,
  'Token Maker',
  'Combo Player',
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
    displayName: MOCK_DISPLAY_NAMES[randomIndex] ?? null,
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
    displayName: profile.displayName,
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

/**
 * Record when playing as enemies or teammates
 */
export type RelationshipRecord = {
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

/**
 * Format-specific record against a player
 */
export type FormatVsRecord = {
  formatSlug: string
  formatName: string
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

/**
 * Commander performance against a specific opponent
 */
export type CommanderVsRecord = {
  commanderName: string
  colorIdentity: ('W' | 'U' | 'B' | 'R' | 'G')[]
  wins: number
  losses: number
  matchesPlayed: number
  winRate: number
}

/**
 * Comprehensive player comparison data
 */
export type PlayerComparisonData = {
  you: ProfileSummary & { stats: PlayerStats; rating: number }
  opponent: ProfileSummary & { stats: PlayerStats; rating: number }
  asEnemies: RelationshipRecord
  asTeammates: RelationshipRecord
  byFormat: FormatVsRecord[]
  bestCommander: CommanderVsRecord | null
}

/**
 * Create mock comparison data between current user and another player
 */
export function createMockPlayerComparison(
  opponent: ProfileSummary,
  opponentStats: PlayerStats,
  opponentRating: number
): PlayerComparisonData {
  // Create "you" (current user) with some variation
  const youProfile = createMockProfile({ username: 'you_gamer' })
  const youStats = createMockPlayerStats({ totalMatches: 72, wins: 34 })
  const youRating = 1050 + Math.floor(Math.random() * 200)

  // Generate as enemies record
  const enemyMatches = 8 + Math.floor(Math.random() * 20)
  const enemyWins = Math.floor(enemyMatches * (0.3 + Math.random() * 0.4))
  const enemyLosses = enemyMatches - enemyWins

  // Generate as teammates record
  const teammateMatches = 3 + Math.floor(Math.random() * 10)
  const teammateWins = Math.floor(teammateMatches * (0.4 + Math.random() * 0.3))
  const teammateLosses = teammateMatches - teammateWins

  // Generate format-specific records
  const formats = [
    { slug: 'ffa', name: 'FFA' },
    { slug: '1v1', name: '1v1' },
    { slug: '2v2', name: '2v2' },
    { slug: 'pentagram', name: 'Pentagram' },
  ]

  const byFormat: FormatVsRecord[] = formats
    .map((format) => {
      const matchesPlayed = Math.floor(Math.random() * 12)
      if (matchesPlayed === 0) return null
      const wins = Math.floor(matchesPlayed * (0.2 + Math.random() * 0.6))
      return {
        formatSlug: format.slug,
        formatName: format.name,
        wins,
        losses: matchesPlayed - wins,
        matchesPlayed,
        winRate: Math.round((wins / matchesPlayed) * 100),
      }
    })
    .filter((f): f is FormatVsRecord => f !== null)
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed)

  // Generate best commander against them
  const commanders = [
    { name: "Atraxa, Praetors' Voice", colors: ['W', 'U', 'B', 'G'] as const },
    { name: 'Korvold, Fae-Cursed King', colors: ['B', 'R', 'G'] as const },
    { name: "Yuriko, the Tiger's Shadow", colors: ['U', 'B'] as const },
    { name: 'Krenko, Mob Boss', colors: ['R'] as const },
  ]

  const bestCommanderData = commanders[Math.floor(Math.random() * commanders.length)]
  const cmdMatches = 3 + Math.floor(Math.random() * 8)
  const cmdWins = Math.floor(cmdMatches * (0.5 + Math.random() * 0.4))

  const bestCommander: CommanderVsRecord = {
    commanderName: bestCommanderData.name,
    colorIdentity: [...bestCommanderData.colors],
    wins: cmdWins,
    losses: cmdMatches - cmdWins,
    matchesPlayed: cmdMatches,
    winRate: Math.round((cmdWins / cmdMatches) * 100),
  }

  return {
    you: {
      id: youProfile.id,
      username: youProfile.username,
      displayName: youProfile.displayName,
      avatarUrl: youProfile.avatarUrl,
      stats: youStats,
      rating: youRating,
    },
    opponent: {
      id: opponent.id,
      username: opponent.username,
      displayName: opponent.displayName,
      avatarUrl: opponent.avatarUrl,
      stats: opponentStats,
      rating: opponentRating,
    },
    asEnemies: {
      wins: enemyWins,
      losses: enemyLosses,
      matchesPlayed: enemyMatches,
      winRate: Math.round((enemyWins / enemyMatches) * 100),
    },
    asTeammates: {
      wins: teammateWins,
      losses: teammateLosses,
      matchesPlayed: teammateMatches,
      winRate: Math.round((teammateWins / teammateMatches) * 100),
    },
    byFormat,
    bestCommander,
  }
}
