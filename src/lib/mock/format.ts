/**
 * Mock Format Factories
 */

import type { Format, FormatSlug, FormatSummary } from '@/types'
import { generateMockId } from './utils'

// ============================================
// Mock Data
// ============================================

const FORMAT_CONFIGS: Record<FormatSlug, Omit<Format, 'id' | 'isActive'>> = {
  '1v1': {
    name: '1v1',
    slug: '1v1',
    minPlayers: 2,
    maxPlayers: 2,
    hasTeams: true,
    winConditionType: 'eliminate_team',
    config: { format: '1v1', teamCount: 2, playersPerTeam: 1 },
  },
  '2v2': {
    name: '2v2',
    slug: '2v2',
    minPlayers: 4,
    maxPlayers: 4,
    hasTeams: true,
    winConditionType: 'eliminate_team',
    config: { format: '2v2', teamCount: 2, playersPerTeam: 2 },
  },
  '3v3': {
    name: '3v3',
    slug: '3v3',
    minPlayers: 6,
    maxPlayers: 6,
    hasTeams: true,
    winConditionType: 'eliminate_team',
    config: { format: '3v3', teamCount: 2, playersPerTeam: 3 },
  },
  ffa: {
    name: 'Free For All',
    slug: 'ffa',
    minPlayers: 3,
    maxPlayers: null,
    hasTeams: false,
    winConditionType: 'last_standing',
    config: { format: 'ffa', teamCount: null, playersPerTeam: null },
  },
  pentagram: {
    name: 'Pentagram',
    slug: 'pentagram',
    minPlayers: 5,
    maxPlayers: 5,
    hasTeams: false,
    winConditionType: 'eliminate_targets',
    config: {
      format: 'pentagram',
      playerCount: 5,
      adjacencyMap: { 0: [1, 4], 1: [0, 2], 2: [1, 3], 3: [2, 4], 4: [3, 0] },
    },
  },
}

// ============================================
// Factory Functions
// ============================================

export function createMockFormat(
  slug: FormatSlug = 'ffa',
  overrides: Partial<Format> = {}
): Format {
  return {
    id: generateMockId(),
    isActive: true,
    ...FORMAT_CONFIGS[slug],
    ...overrides,
  }
}

export function createMockFormatSummary(
  slug: FormatSlug = 'ffa',
  overrides: Partial<FormatSummary> = {}
): FormatSummary {
  const format = createMockFormat(slug, overrides)
  return {
    id: format.id,
    name: format.name,
    slug: format.slug,
    minPlayers: format.minPlayers,
    maxPlayers: format.maxPlayers,
    hasTeams: format.hasTeams,
  }
}

export function createAllMockFormats(): Format[] {
  return (['1v1', '2v2', '3v3', 'ffa', 'pentagram'] as FormatSlug[]).map(
    (slug) => createMockFormat(slug)
  )
}
