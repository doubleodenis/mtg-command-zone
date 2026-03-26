/**
 * Match Service
 *
 * Business logic for match-related data transformations and aggregations.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type {
  MatchCardData,
  ParticipantDisplayInfo,
  PendingConfirmation,
} from '@/types/match'
import type { FormatSlug, ParticipantData } from '@/types/format'
import { mapDeckSummary, mapProfileSummary } from '@/types/database-mappers'

// ============================================
// Helpers
// ============================================

/**
 * Validate and cast participant_data jsonb to typed ParticipantData
 */
function validateParticipantData(data: unknown): ParticipantData {
  if (!data || typeof data !== 'object') {
    return { format: 'ffa' }
  }

  const obj = data as Record<string, unknown>
  const format = obj.format

  if (format === 'ffa' || format === '1v1') {
    return { format }
  }

  if (format === '2v2' || format === '3v3') {
    return {
      format,
      teamId: typeof obj.teamId === 'string' ? obj.teamId : '',
    }
  }

  if (format === 'pentagram') {
    const seatPosition = typeof obj.seatPosition === 'number' ? obj.seatPosition : 0
    return {
      format,
      seatPosition: seatPosition as 0 | 1 | 2 | 3 | 4,
      targetParticipantIds: Array.isArray(obj.targetParticipantIds)
        ? (obj.targetParticipantIds as [string, string])
        : ['', ''],
      allyParticipantIds: Array.isArray(obj.allyParticipantIds)
        ? (obj.allyParticipantIds as [string, string])
        : ['', ''],
    }
  }

  return { format: 'ffa' }
}

// ============================================
// Recent Match Cards
// ============================================

export type GetRecentMatchCardsOptions = {
  limit?: number
  userId?: string
}

/**
 * Get recent matches transformed for MatchPreviewCard display.
 * Combines match, participant, format, and profile data.
 */
export async function getRecentMatchCards(
  client: SupabaseClient<Database>,
  options: GetRecentMatchCardsOptions = {}
): Promise<Result<MatchCardData[]>> {
  const { limit = 5, userId } = options

  // Build base query
  let matchQuery = client
    .from('matches')
    .select(`
      id,
      played_at,
      format:formats!matches_format_id_fkey(name, slug)
    `)
    .order('played_at', { ascending: false })
    .limit(limit)

  // Filter to user's matches if requested
  if (userId) {
    const { data: participations } = await client
      .from('match_participants')
      .select('match_id')
      .eq('user_id', userId)

    if (!participations || participations.length === 0) {
      return { success: true, data: [] }
    }

    const matchIds = participations.map((p) => p.match_id)
    matchQuery = matchQuery.in('id', matchIds)
  }

  const { data: matches, error: matchError } = await matchQuery

  if (matchError) {
    return { success: false, error: matchError.message }
  }

  if (!matches || matches.length === 0) {
    return { success: true, data: [] }
  }

  // Transform matches to card data with participant details
  const matchCards = await Promise.all(
    matches.map((match) => transformMatchToCardData(client, match, userId))
  )

  return { success: true, data: matchCards }
}

/**
 * Transform a raw match row into MatchCardData with participant details
 */
async function transformMatchToCardData(
  client: SupabaseClient<Database>,
  match: { id: string; played_at: string; format: { name: string; slug: string } },
  userId?: string
): Promise<MatchCardData> {
  const { data: participants } = await client
    .from('match_participants')
    .select(`
      id,
      user_id,
      placeholder_name,
      is_winner,
      confirmed_at,
      team,
      participant_data,
      deck:decks!match_participants_deck_id_fkey(*),
      profile:profiles!match_participants_user_id_fkey(*)
    `)
    .eq('match_id', match.id)

  const participantInfos: ParticipantDisplayInfo[] = (participants ?? []).map((p) => ({
    id: p.id,
    name: p.profile ? mapProfileSummary(p.profile).username : p.placeholder_name ?? 'Unknown',
    avatarUrl: p.profile ? mapProfileSummary(p.profile).avatarUrl : null,
    isRegistered: !!p.user_id,
    isConfirmed: !!p.confirmed_at,
    deck: p.deck ? mapDeckSummary(p.deck) : null,
    team: p.team,
    isWinner: p.is_winner,
    ratingDelta: null,
    participantData: validateParticipantData(p.participant_data),
  }))

  const userParticipant = userId
    ? participantInfos.find((info) => {
        const participant = participants?.find((p) => p.id === info.id)
        return participant?.user_id === userId
      }) ?? null
    : null

  return {
    id: match.id,
    formatName: match.format.name,
    formatSlug: match.format.slug as FormatSlug,
    playedAt: match.played_at,
    participantCount: participantInfos.length,
    confirmedCount: participantInfos.filter((p) => p.isConfirmed).length,
    winnerNames: participantInfos.filter((p) => p.isWinner).map((p) => p.name),
    isFullyConfirmed: participantInfos.every((p) => p.isConfirmed),
    participants: participantInfos,
    userParticipant,
  }
}

// ============================================
// Pending Confirmations
// ============================================

/**
 * Get pending match confirmations for a user with match summary details.
 */
export async function getUserPendingConfirmations(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<PendingConfirmation[]>> {
  const { data: participations, error } = await client
    .from('match_participants')
    .select(`
      id,
      match_id,
      created_at,
      match:matches!match_participants_match_id_fkey(
        id,
        played_at,
        format:formats!matches_format_id_fkey(name, slug)
      )
    `)
    .eq('user_id', userId)
    .is('confirmed_at', null)

  if (error) {
    return { success: false, error: error.message }
  }

  if (!participations || participations.length === 0) {
    return { success: true, data: [] }
  }

  // Enrich each participation with match participant counts
  const confirmations = await Promise.all(
    participations.map((p) => transformToPendingConfirmation(client, p))
  )

  return { success: true, data: confirmations }
}

/**
 * Transform a participation row into a PendingConfirmation with match summary
 */
async function transformToPendingConfirmation(
  client: SupabaseClient<Database>,
  participation: {
    id: string
    match_id: string
    created_at: string | null
    match: { id: string; played_at: string; format: { name: string; slug: string } }
  }
): Promise<PendingConfirmation> {
  const { data: allParticipants } = await client
    .from('match_participants')
    .select('id, is_winner, confirmed_at, placeholder_name')
    .eq('match_id', participation.match_id)

  const participantCount = allParticipants?.length ?? 0
  const confirmedCount = allParticipants?.filter((p) => p.confirmed_at).length ?? 0
  const winnerNames = allParticipants
    ?.filter((p) => p.is_winner)
    .map((p) => p.placeholder_name ?? 'Player') ?? []

  return {
    matchId: participation.match_id,
    participantId: participation.id,
    match: {
      id: participation.match.id,
      formatName: participation.match.format.name,
      formatSlug: participation.match.format.slug as FormatSlug,
      playedAt: participation.match.played_at,
      participantCount,
      confirmedCount,
      winnerNames,
      isFullyConfirmed: false,
    },
    createdAt: participation.created_at ?? new Date().toISOString(),
  }
}
