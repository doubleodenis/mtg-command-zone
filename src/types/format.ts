/**
 * Format types - game format configuration
 */

import type { UUID } from './common'

/**
 * Win condition types for formats
 */
export type WinConditionType = 'last_standing' | 'eliminate_team' | 'eliminate_targets'

/**
 * Format slug identifiers
 */
export type FormatSlug = '1v1' | '2v2' | '3v3' | 'ffa' | 'pentagram'

/**
 * Base format record (maps to formats table)
 */
export type Format = {
  id: UUID
  name: string
  slug: FormatSlug
  minPlayers: number
  maxPlayers: number | null
  hasTeams: boolean
  winConditionType: WinConditionType
  config: FormatConfig
  isActive: boolean
}

/**
 * Format summary for selection UI
 */
export type FormatSummary = Pick<Format, 'id' | 'name' | 'slug' | 'minPlayers' | 'maxPlayers' | 'hasTeams'>

// ============================================
// Format Configuration - Discriminated Unions
// ============================================

/**
 * Format-specific configuration stored in formats.config jsonb
 * Defines the expected shape of match_data and participant_data for each format
 */
export type FormatConfig =
  | FormatConfig1v1
  | FormatConfig2v2
  | FormatConfig3v3
  | FormatConfigFFA
  | FormatConfigPentagram

/**
 * 1v1 format config
 */
export type FormatConfig1v1 = {
  format: '1v1'
  teamCount: 2
  playersPerTeam: 1
}

/**
 * 2v2 format config
 */
export type FormatConfig2v2 = {
  format: '2v2'
  teamCount: 2
  playersPerTeam: 2
}

/**
 * 3v3 format config
 */
export type FormatConfig3v3 = {
  format: '3v3'
  teamCount: 2
  playersPerTeam: 3
}

/**
 * FFA (Free For All) format config
 */
export type FormatConfigFFA = {
  format: 'ffa'
  teamCount: null
  playersPerTeam: null
}

/**
 * Pentagram format config with adjacency rules
 */
export type FormatConfigPentagram = {
  format: 'pentagram'
  playerCount: 5
  /**
   * Adjacency map: for each seat position (0-4), lists the indices of adjacent (ally) seats
   * Non-adjacent seats are enemies
   */
  adjacencyMap: Record<number, [number, number]>
}

// ============================================
// Match-level Data - Discriminated Unions
// ============================================

/**
 * Format-specific match-level metadata stored in matches.match_data jsonb
 */
export type MatchData =
  | MatchDataSimple
  | MatchDataTeam
  | MatchDataPentagram

/**
 * Match data for FFA - no additional data needed
 */
export type MatchDataSimple = {
  format: 'ffa' | '1v1'
}

/**
 * Match data for team formats (2v2, 3v3)
 */
export type MatchDataTeam = {
  format: '2v2' | '3v3'
  teams: {
    [teamId: string]: {
      name?: string
    }
  }
}

/**
 * Match data for Pentagram - records seating arrangement
 */
export type MatchDataPentagram = {
  format: 'pentagram'
  /**
   * Seating order - participant IDs in clockwise order around the star
   * Position in array determines adjacency relationships
   */
  seatingOrder: [UUID, UUID, UUID, UUID, UUID]
}

// ============================================
// Participant-level Data - Discriminated Unions
// ============================================

/**
 * Format-specific participant-level metadata stored in match_participants.participant_data jsonb
 */
export type ParticipantData =
  | ParticipantDataSimple
  | ParticipantDataTeam
  | ParticipantDataPentagram

/**
 * Participant data for FFA and 1v1 - no additional data
 */
export type ParticipantDataSimple = {
  format: 'ffa' | '1v1'
}

/**
 * Participant data for team formats
 */
export type ParticipantDataTeam = {
  format: '2v2' | '3v3'
  teamId: string
}

/**
 * Participant data for Pentagram
 */
export type ParticipantDataPentagram = {
  format: 'pentagram'
  seatPosition: 0 | 1 | 2 | 3 | 4
  /**
   * IDs of this player's target opponents (non-adjacent players)
   * Derived from seating position but stored explicitly for query convenience
   */
  targetParticipantIds: [UUID, UUID]
  /**
   * IDs of this player's allies (adjacent players)
   */
  allyParticipantIds: [UUID, UUID]
}

// ============================================
// Default Pentagram Adjacency Map
// ============================================

/**
 * Standard pentagram adjacency: each player's allies are the two adjacent seats
 * Position 0's allies are 1 and 4, enemies are 2 and 3, etc.
 */
export const PENTAGRAM_ADJACENCY_MAP: Record<number, [number, number]> = {
  0: [1, 4],
  1: [0, 2],
  2: [1, 3],
  3: [2, 4],
  4: [3, 0],
}

/**
 * Get enemy positions for a given seat in pentagram
 */
export function getPentagramEnemies(seatPosition: number): [number, number] {
  const allies = PENTAGRAM_ADJACENCY_MAP[seatPosition]
  const allPositions = [0, 1, 2, 3, 4]
  const enemies = allPositions.filter(p => p !== seatPosition && !allies.includes(p))
  return enemies as [number, number]
}
