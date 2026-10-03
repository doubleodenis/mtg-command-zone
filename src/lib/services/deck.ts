/**
 * Deck Service
 *
 * Business logic for deck-related data transformations and aggregations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { ColorIdentity, Bracket } from '@/types/common'
import { rankCommanders } from './top-commanders'
import type { CommanderParticipationRow, CommanderStats } from './top-commanders'

// ============================================
// Top Commanders
// ============================================

export type GetTopCommandersOptions = {
  limit?: number
  collectionId?: string
}

/**
 * Get top commanders platform-wide or within a collection.
 *
 * Counts confirmed participations only (and, in a collection, only approved
 * matches), groups them by commander, and ranks by win rate with a minimum
 * games threshold — see rankCommanders.
 *
 * Note: PostgREST caps a response at its max-rows setting (1000 by default),
 * so the global scope ranks the most recent ≤1000 confirmed participations.
 * Move the aggregation into SQL if the platform outgrows that.
 */
export async function getTopCommanders(
  client: SupabaseClient<Database>,
  options: GetTopCommandersOptions = {}
): Promise<Result<CommanderStats[]>> {
  const { limit = 5, collectionId } = options

  let matchIds: string[] | null = null
  if (collectionId) {
    const { data: collectionMatches, error: collectionError } = await client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)
      .eq('approval_status', 'approved')

    if (collectionError) {
      return { success: false, error: collectionError.message }
    }

    matchIds = (collectionMatches ?? []).map((cm) => cm.match_id)
    if (matchIds.length === 0) {
      return { success: true, data: [] }
    }
  }

  let query = client
    .from('match_participants')
    .select(`
      is_winner,
      deck:decks!match_participants_deck_id_fkey (
        commander_name,
        partner_name,
        color_identity,
        bracket,
        deck_name
      )
    `)
    .not('confirmed_at', 'is', null)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })

  if (matchIds) {
    query = query.in('match_id', matchIds)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const rows: CommanderParticipationRow[] = []
  for (const p of data ?? []) {
    if (!p.deck) continue
    rows.push({
      isWinner: p.is_winner,
      commanderName: p.deck.commander_name,
      partnerName: p.deck.partner_name,
      colorIdentity: (p.deck.color_identity ?? []) as ColorIdentity,
      bracket: p.deck.bracket as Bracket,
      deckName: p.deck.deck_name,
    })
  }

  return { success: true, data: rankCommanders(rows, { limit }) }
}
