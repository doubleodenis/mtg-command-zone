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
// Single Match Fetch
// ============================================

/**
 * Get a single match by ID, transformed for display.
 */
export async function getMatchById(
  client: SupabaseClient<Database>,
  matchId: string,
  userId?: string
): Promise<Result<MatchCardData>> {
  const { data: match, error } = await client
    .from('matches')
    .select(`
      id,
      played_at,
      format:formats!matches_format_id_fkey(name, slug)
    `)
    .eq('id', matchId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Match not found' }
    }
    return { success: false, error: error.message }
  }

  const matchCard = await transformMatchToCardData(client, match, userId)
  return { success: true, data: matchCard }
}

// ============================================
// Recent Match Cards
// ============================================

export type GetRecentMatchCardsOptions = {
  limit?: number
  /** The user whose matches to fetch (used as filter) */
  userId?: string
  /** The logged-in viewer's ID — used to highlight their slot as "YOU" and suppress claim badges when they're already in a match */
  viewerUserId?: string
  collectionId?: string
}

/**
 * Get recent matches transformed for MatchPreviewCard display.
 * Combines match, participant, format, and profile data.
 */
export async function getRecentMatchCards(
  client: SupabaseClient<Database>,
  options: GetRecentMatchCardsOptions = {}
): Promise<Result<MatchCardData[]>> {
  const { limit = 5, userId, viewerUserId, collectionId } = options

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

  // Filter to collection's matches if requested
  if (collectionId) {
    const { data: collectionMatches } = await client
      .from('collection_matches')
      .select('match_id')
      .eq('collection_id', collectionId)
      .eq('approval_status', 'approved')

    if (!collectionMatches || collectionMatches.length === 0) {
      return { success: true, data: [] }
    }

    const matchIds = collectionMatches.map((cm) => cm.match_id)
    matchQuery = matchQuery.in('id', matchIds)
  }

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
  // Use viewerUserId (if provided) to correctly identify the logged-in user's slot,
  // even when filtering matches by a different user's profile.
  const matchCards = await Promise.all(
    matches.map((match) => transformMatchToCardData(client, match, viewerUserId ?? userId))
  )

  return { success: true, data: matchCards }
}

/**
 * Transform a raw match row into MatchCardData with participant details
 */
async function transformMatchToCardData(
  client: SupabaseClient<Database>,
  match: {
    id: string;
    played_at: string;
    format: { name: string; slug: string };
  },
  userId?: string,
): Promise<MatchCardData> {
  // Fetch participants and rating history in parallel
  const [participantsResult, ratingHistoryResult] = await Promise.all([
    client
      .from("match_participants")
      .select(
        `
        id,
        user_id,
        placeholder_name,
        is_winner,
        confirmed_at,
        team,
        participant_data,
        claim_status,
        deck:decks!match_participants_deck_id_fkey(*),
        profile:profiles!match_participants_user_id_fkey(*)
      `,
      )
      .eq("match_id", match.id),
    client
      .from("rating_history")
      .select("user_id, delta, rating_before, rating_after")
      .eq("match_id", match.id),
  ]);

  const participants = participantsResult.data ?? [];
  const ratingHistory = ratingHistoryResult.data ?? [];

  // Create lookup map for rating deltas by user_id
  const ratingDeltaMap = new Map(
    ratingHistory.map((rh) => [
      rh.user_id,
      {
        before: rh.rating_before,
        after: rh.rating_after,
        delta: rh.delta,
        isPositive: rh.delta > 0,
      },
    ]),
  );

  const participantInfos: ParticipantDisplayInfo[] = participants.map((p) => ({
    id: p.id,
    userId: p.user_id,
    name: p.profile
      ? mapProfileSummary(p.profile).username
      : (p.placeholder_name ?? "Unknown"),
    avatarUrl: p.profile ? mapProfileSummary(p.profile).avatarUrl : null,
    isRegistered: !!p.user_id,
    isConfirmed: !!p.confirmed_at,
    deck: p.deck ? mapDeckSummary(p.deck) : null,
    team: p.team,
    isWinner: p.is_winner,
    ratingDelta: p.user_id ? (ratingDeltaMap.get(p.user_id) ?? null) : null,
    participantData: validateParticipantData(p.participant_data),
    claimStatus: p.claim_status,
  }));

  const userParticipant = userId
    ? (participantInfos.find((info) => {
        const participant = participants?.find((p) => p.id === info.id);
        return participant?.user_id === userId;
      }) ?? null)
    : null;

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
  };
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
  // Query participations without nested join to avoid PostgREST coercion issues
  const { data: participations, error } = await client
    .from('match_participants')
    .select('id, match_id, deck_id, created_at')
    .eq('user_id', userId)
    .is('confirmed_at', null)

  if (error) {
    return { success: false, error: error.message }
  }

  if (!participations || participations.length === 0) {
    return { success: true, data: [] }
  }

  // Enrich each participation with match details
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
    deck_id: string | null
    created_at: string | null
  }
): Promise<PendingConfirmation> {
  // Fetch match with format separately to avoid nested join issues
  const { data: match } = await client
    .from('matches')
    .select('id, played_at, format_id')
    .eq('id', participation.match_id)
    .single()

  // Fetch format info
  const { data: format } = match
    ? await client
        .from('formats')
        .select('name, slug')
        .eq('id', match.format_id)
        .single()
    : { data: null }

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
      id: match?.id ?? participation.match_id,
      formatName: format?.name ?? 'Unknown',
      formatSlug: (format?.slug ?? 'ffa') as FormatSlug,
      playedAt: match?.played_at ?? new Date().toISOString(),
      participantCount,
      confirmedCount,
      winnerNames,
      isFullyConfirmed: false,
    },
    createdAt: participation.created_at ?? new Date().toISOString(),
    hasDeckAssigned: participation.deck_id !== null,
  }
}
