/**
 * Deck types - commanders/decks with brackets
 */

import type { Bracket, ColorIdentity, ISODateString, UUID } from './common'

/**
 * Deck record (maps to decks table)
 */
export type Deck = {
  id: UUID
  ownerId: UUID
  commanderName: string
  partnerName: string | null
  deckName: string | null
  colorIdentity: ColorIdentity
  bracket: Bracket
  isActive: boolean
  createdAt: ISODateString
}

/**
 * Deck summary for lists and selection UI
 */
export type DeckSummary = Pick<
  Deck,
  'id' | 'commanderName' | 'partnerName' | 'deckName' | 'colorIdentity' | 'bracket'
>

/**
 * Deck with aggregated stats
 */
export type DeckWithStats = Deck & {
  stats: DeckStats
}

/**
 * Deck statistics (derived from matches)
 */
export type DeckStats = {
  gamesPlayed: number
  wins: number
  losses: number
  winRate: number
}

/**
 * Payload for creating a new deck
 */
export type CreateDeckPayload = {
  commanderName: string
  partnerName?: string | null
  deckName?: string | null
  colorIdentity: ColorIdentity
  bracket: Bracket
}

/**
 * Payload for updating a deck
 */
export type UpdateDeckPayload = {
  commanderName?: string
  partnerName?: string | null
  deckName?: string | null
  colorIdentity?: ColorIdentity
  bracket?: Bracket
  isActive?: boolean
}

/**
 * Placeholder deck sentinel value
 * Used when commander is not known at match creation time
 */
export const PLACEHOLDER_DECK_NAME = 'Unknown Deck'

/**
 * Check if a deck is the placeholder
 */
export function isPlaceholderDeck(deck: DeckSummary): boolean {
  return deck.deckName === PLACEHOLDER_DECK_NAME
}

/**
 * Scryfall card data (subset of fields we use for autocomplete)
 */
export type ScryfallCard = {
  id: string
  name: string
  imageUris?: {
    small?: string
    normal?: string
    large?: string
    artCrop?: string
  }
  cardFaces?: Array<{
    name: string
    imageUris?: {
      small?: string
      normal?: string
      large?: string
      artCrop?: string
    }
  }>
  typeLine: string
  oracleText?: string
  colorIdentity: string[]
  legalities: Record<string, string>
}

/**
 * Card preview for commander search/selection
 */
export type CardPreview = {
  scryfallId: string
  name: string
  imageUri: string | null
  typeLine: string
  colorIdentity: ColorIdentity
}
