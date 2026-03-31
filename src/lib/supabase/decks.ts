/**
 * Deck Supabase Query Helpers
 *
 * All queries for deck CRUD and statistics.
 * Uses mappers at the boundary to convert DB types to application types.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { Deck, DeckSummary, DeckWithStats, DeckStats, CreateDeckPayload, UpdateDeckPayload } from '@/types/deck'
import { mapDeckRow, mapDeckSummary, mapDeckWithStats } from '@/types/database-mappers'

// ============================================
// Deck Queries
// ============================================

/**
 * Get a deck by ID
 */
export async function getDeckById(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<Deck>> {
  const { data, error } = await client
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapDeckRow(data) }
}

/**
 * Get all decks for a user
 */
export async function getUserDecks(
  client: SupabaseClient<Database>,
  userId: string,
  includeRetired = true
): Promise<Result<Deck[]>> {
  let query = client
    .from('decks')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (!includeRetired) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map(mapDeckRow) }
}

/**
 * Get active decks for a user (for deck selection in match creation)
 */
export async function getActiveDecks(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<DeckSummary[]>> {
  const { data, error } = await client
    .from('decks')
    .select('*')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('commander_name', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map(mapDeckSummary) }
}

/**
 * Get a user's deck with stats
 * Uses the get_deck_stats database function
 */
export async function getDeckWithStats(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<DeckWithStats>> {
  // Fetch deck and stats in parallel
  const [deckResult, statsResult] = await Promise.all([
    client.from('decks').select('*').eq('id', deckId).single(),
    client.rpc('get_deck_stats', { p_deck_id: deckId }),
  ])

  if (deckResult.error) {
    return { success: false, error: deckResult.error.message }
  }

  if (statsResult.error) {
    return { success: false, error: statsResult.error.message }
  }

  // get_deck_stats returns an array with a single row
  const statsArray = statsResult.data as Array<{
    games_played: number
    wins: number
    losses: number
    win_rate: number
  }> | null
  const statsData = statsArray?.[0] ?? null

  const stats: DeckStats = statsData
    ? {
        gamesPlayed: statsData.games_played,
        wins: statsData.wins,
        losses: statsData.losses,
        winRate: statsData.win_rate,
      }
    : {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      }

  return { success: true, data: mapDeckWithStats(deckResult.data, stats) }
}

/**
 * Get all decks with stats for a user
 */
export async function getUserDecksWithStats(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<DeckWithStats[]>> {
  const { data: decks, error: decksError } = await client
    .from('decks')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (decksError) {
    return { success: false, error: decksError.message }
  }

  // Fetch stats for all decks in parallel
  const statsPromises = decks.map((deck) =>
    client.rpc('get_deck_stats', { p_deck_id: deck.id })
  )
  const statsResults = await Promise.all(statsPromises)

  // Combine decks with their stats
  const decksWithStats: DeckWithStats[] = decks.map((deck, i) => {
    const statsArray = statsResults[i].data as Array<{
      games_played: number
      wins: number
      losses: number
      win_rate: number
    }> | null
    const statsData = statsArray?.[0] ?? null

    const stats: DeckStats = statsData
      ? {
          gamesPlayed: statsData.games_played,
          wins: statsData.wins,
          losses: statsData.losses,
          winRate: statsData.win_rate,
        }
      : {
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        }

    return mapDeckWithStats(deck, stats)
  })

  return { success: true, data: decksWithStats }
}

// ============================================
// Deck Mutations
// ============================================

/**
 * Create a new deck
 */
export async function createDeck(
  client: SupabaseClient<Database>,
  userId: string,
  payload: CreateDeckPayload
): Promise<Result<Deck>> {
  const { data, error } = await client
    .from('decks')
    .insert({
      owner_id: userId,
      commander_name: payload.commanderName,
      partner_name: payload.partnerName ?? null,
      deck_name: payload.deckName ?? null,
      color_identity: payload.colorIdentity,
      bracket: payload.bracket,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapDeckRow(data) }
}

/**
 * Update a deck
 */
export async function updateDeck(
  client: SupabaseClient<Database>,
  deckId: string,
  payload: UpdateDeckPayload
): Promise<Result<Deck>> {
  const updates: Record<string, unknown> = {}
  
  if (payload.commanderName !== undefined) updates.commander_name = payload.commanderName
  if (payload.partnerName !== undefined) updates.partner_name = payload.partnerName
  if (payload.deckName !== undefined) updates.deck_name = payload.deckName
  if (payload.colorIdentity !== undefined) updates.color_identity = payload.colorIdentity
  if (payload.bracket !== undefined) updates.bracket = payload.bracket
  if (payload.isActive !== undefined) updates.is_active = payload.isActive

  const { data, error } = await client
    .from('decks')
    .update(updates)
    .eq('id', deckId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: mapDeckRow(data) }
}

/**
 * Retire a deck (set isActive to false)
 * Once a deck has been used in a match, it cannot be deleted, only retired
 */
export async function retireDeck(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<Deck>> {
  return updateDeck(client, deckId, { isActive: false })
}

/**
 * Reactivate a retired deck
 */
export async function reactivateDeck(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<Deck>> {
  return updateDeck(client, deckId, { isActive: true })
}

/**
 * Delete a deck (only allowed if never used in a match)
 */
export async function deleteDeck(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<null>> {
  // First check if deck has been used in any matches
  const { count, error: countError } = await client
    .from('match_participants')
    .select('*', { count: 'exact', head: true })
    .eq('deck_id', deckId)

  if (countError) {
    return { success: false, error: countError.message }
  }

  if (count && count > 0) {
    return { 
      success: false, 
      error: 'Cannot delete a deck that has been used in matches. Retire it instead.' 
    }
  }

  const { error } = await client
    .from('decks')
    .delete()
    .eq('id', deckId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Check if a deck can be edited (not used in any matches)
 */
export async function canEditDeck(
  client: SupabaseClient<Database>,
  deckId: string
): Promise<Result<boolean>> {
  const { count, error } = await client
    .from('match_participants')
    .select('*', { count: 'exact', head: true })
    .eq('deck_id', deckId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Can edit if deck has never been used
  return { success: true, data: count === 0 }
}
