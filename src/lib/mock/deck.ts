/**
 * Mock Deck Factories
 */

import type {
  Bracket,
  Deck,
  DeckStats,
  DeckSummary,
  DeckWithStats,
  UUID,
} from '@/types'
import { PLACEHOLDER_DECK_NAME } from '@/types/deck'
import { generateMockDate, generateMockId } from './utils'

// ============================================
// Mock Data
// ============================================

const MOCK_COMMANDERS = [
  { name: "Atraxa, Praetors' Voice", colors: ['W', 'U', 'B', 'G'] as const },
  { name: 'Edgar Markov', colors: ['W', 'B', 'R'] as const },
  { name: 'Korvold, Fae-Cursed King', colors: ['B', 'R', 'G'] as const },
  { name: "Yuriko, the Tiger's Shadow", colors: ['U', 'B'] as const },
  { name: 'Kenrith, the Returned King', colors: ['W', 'U', 'B', 'R', 'G'] as const },
  { name: 'Krenko, Mob Boss', colors: ['R'] as const },
  { name: 'Urza, Lord High Artificer', colors: ['U'] as const },
  { name: 'Tymna the Weaver', colors: ['W', 'B'] as const },
  { name: 'Meren of Clan Nel Toth', colors: ['B', 'G'] as const },
  { name: 'The Gitrog Monster', colors: ['B', 'G'] as const },
]

// ============================================
// Factory Functions
// ============================================

export function createMockDeck(overrides: Partial<Deck> = {}): Deck {
  const id = overrides.id ?? generateMockId()
  const index = parseInt(id.split('-')[1] || '0') % MOCK_COMMANDERS.length
  const commander = MOCK_COMMANDERS[index]

  return {
    id,
    ownerId: generateMockId(),
    commanderName: commander.name,
    partnerName: null,
    deckName: null,
    colorIdentity: [...commander.colors],
    bracket: 2 as Bracket,
    isActive: true,
    createdAt: generateMockDate(60),
    ...overrides,
  }
}

export function createMockDeckSummary(
  overrides: Partial<DeckSummary> = {}
): DeckSummary {
  const deck = createMockDeck(overrides)
  return {
    id: deck.id,
    commanderName: deck.commanderName,
    partnerName: deck.partnerName,
    deckName: deck.deckName,
    colorIdentity: deck.colorIdentity,
    bracket: deck.bracket,
  }
}

export function createMockDeckStats(
  overrides: Partial<DeckStats> = {}
): DeckStats {
  const gamesPlayed = overrides.gamesPlayed ?? 30
  const wins = overrides.wins ?? Math.floor(gamesPlayed * 0.4)

  return {
    gamesPlayed,
    wins,
    losses: gamesPlayed - wins,
    winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    ...overrides,
  }
}

export function createMockDeckWithStats(
  overrides: Partial<DeckWithStats> = {}
): DeckWithStats {
  return {
    ...createMockDeck(overrides),
    stats: createMockDeckStats(overrides.stats),
    ...overrides,
  }
}

export function createMockPlaceholderDeck(ownerId: UUID): DeckSummary {
  return {
    id: generateMockId(),
    commanderName: 'Unknown Commander',
    partnerName: null,
    deckName: PLACEHOLDER_DECK_NAME,
    colorIdentity: [],
    bracket: 2 as Bracket,
  }
}
