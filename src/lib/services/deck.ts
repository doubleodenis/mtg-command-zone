/**
 * Deck Service
 *
 * Business logic for deck-related data transformations and aggregations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { DeckWithStats } from '@/types/deck'
import type { ColorIdentity, Bracket } from '@/types/common'

// ============================================
// Top Commanders
// ============================================

export type GetTopCommandersOptions = {
  limit?: number
  collectionId?: string
}

/**
 * Get top commanders platform-wide or within a collection, ranked by total matches.
 * Returns DeckWithStats[] for compatibility with TopCommandersList component.
 */
export async function getTopCommanders(
  client: SupabaseClient<Database>,
  options: GetTopCommandersOptions = {}
): Promise<Result<DeckWithStats[]>> {
  const { limit = 5, collectionId } = options

  // Get decks with their participation data
  const { data: decks, error: decksError } = await client
    .from('decks')
    .select(`
      id,
      deck_name,
      commander_name,
      partner_name,
      color_identity,
      bracket,
      is_active,
      created_at,
      owner_id
    `)
    .limit(limit * 2) // Fetch extra to filter after counting

  if (decksError) {
    return { success: false, error: decksError.message }
  }

  if (!decks || decks.length === 0) {
    return { success: true, data: [] }
  }

  // Count matches for each deck
  const deckStatsPromises = decks.map(async (deck) => {
    let participationsQuery = client
      .from('match_participants')
      .select('match_id, is_winner')
      .eq('deck_id', deck.id)

    // If collectionId specified, filter to matches in that collection
    if (collectionId) {
      const { data: collectionMatches } = await client
        .from('collection_matches')
        .select('match_id')
        .eq('collection_id', collectionId)

      if (!collectionMatches || collectionMatches.length === 0) {
        return null
      }

      const matchIds = collectionMatches.map((cm) => cm.match_id)
      participationsQuery = participationsQuery.in('match_id', matchIds)
    }

    const { data: participations } = await participationsQuery

    if (!participations || participations.length === 0) {
      return null
    }

    const gamesPlayed = participations.length
    const wins = participations.filter((p) => p.is_winner).length
    const losses = gamesPlayed - wins
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0

    return {
      id: deck.id,
      ownerId: deck.owner_id,
      commanderName: deck.commander_name,
      partnerName: deck.partner_name,
      deckName: deck.deck_name,
      colorIdentity: (deck.color_identity ?? []) as ColorIdentity,
      bracket: deck.bracket as Bracket,
      isActive: deck.is_active,
      createdAt: deck.created_at ?? new Date().toISOString(),
      stats: {
        gamesPlayed,
        wins,
        losses,
        winRate,
      },
    } satisfies DeckWithStats
  })

  const allStats = await Promise.all(deckStatsPromises)
  const validStats = allStats.filter((s): s is DeckWithStats => s !== null)

  // Sort by total matches and take top N
  const topCommanders = validStats
    .sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed)
    .slice(0, limit)

  return { success: true, data: topCommanders }
}
