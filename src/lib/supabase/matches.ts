/**
 * Match Supabase Query Helpers
 *
 * All queries for match CRUD, confirmation, and participation.
 * Validates and casts jsonb fields (match_data, participant_data) at the boundary.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result, PaginationParams } from '@/types'
import type {
  Match,
  MatchParticipant,
  MatchParticipantWithDetails,
  MatchWithParticipants,
  MatchSummary,
  CreateMatchPayload,
  ClaimableMatchSlot,
} from "@/types/match";
import type { FormatSlug, MatchData, ParticipantData } from "@/types/format";
import { PENTAGRAM_ADJACENCY_MAP, getPentagramEnemies } from "@/types/format";
import {
  mapMatchRow,
  mapMatchParticipantRow,
  mapFormatSummary,
  mapProfileSummary,
  mapDeckSummary,
} from "@/types/database-mappers";

// ============================================
// JSONB Validation Helpers
// ============================================

/**
 * Validate and cast match_data jsonb to typed MatchData
 * Returns null if validation fails
 */
function validateMatchData(data: unknown): MatchData | null {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  const format = obj.format;

  if (format === "ffa" || format === "1v1") {
    return { format };
  }

  if (format === "2v2" || format === "3v3") {
    if (typeof obj.teams === "object" && obj.teams !== null) {
      return { format, teams: obj.teams as Record<string, { name?: string }> };
    }
    // Teams not required, can be empty
    return { format, teams: {} };
  }

  if (format === "pentagram") {
    if (Array.isArray(obj.seatingOrder) && obj.seatingOrder.length === 5) {
      return {
        format,
        seatingOrder: obj.seatingOrder as [
          string,
          string,
          string,
          string,
          string,
        ],
      };
    }
    return null;
  }

  return null;
}

/**
 * Validate and cast participant_data jsonb to typed ParticipantData
 * Returns a default simple format if validation fails
 */
function validateParticipantData(data: unknown): ParticipantData {
  if (!data || typeof data !== "object") {
    return { format: "ffa" };
  }

  const obj = data as Record<string, unknown>;
  const format = obj.format;

  if (format === "ffa" || format === "1v1") {
    return { format };
  }

  if (format === "2v2" || format === "3v3") {
    return {
      format,
      teamId: typeof obj.teamId === "string" ? obj.teamId : "",
    };
  }

  if (format === "pentagram") {
    const seatPosition =
      typeof obj.seatPosition === "number" ? obj.seatPosition : 0;
    return {
      format,
      seatPosition: seatPosition as 0 | 1 | 2 | 3 | 4,
      targetParticipantIds: Array.isArray(obj.targetParticipantIds)
        ? (obj.targetParticipantIds as [string, string])
        : ["", ""],
      allyParticipantIds: Array.isArray(obj.allyParticipantIds)
        ? (obj.allyParticipantIds as [string, string])
        : ["", ""],
    };
  }

  return { format: "ffa" };
}

// ============================================
// Match Queries
// ============================================

/**
 * Get a match by ID
 */
export async function getMatchById(
  client: SupabaseClient<Database>,
  matchId: string,
): Promise<Result<Match>> {
  const { data, error } = await client
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const matchData = validateMatchData(data.match_data);
  if (!matchData) {
    return { success: false, error: "Invalid match_data format" };
  }

  return {
    success: true,
    data: {
      ...mapMatchRow(data),
      matchData,
    },
  };
}

/**
 * Get a match with full details (format, creator, participants)
 */
export async function getMatchWithDetails(
  client: SupabaseClient<Database>,
  matchId: string,
): Promise<Result<MatchWithParticipants>> {
  // Fetch match with format and creator
  const { data: match, error: matchError } = await client
    .from("matches")
    .select(
      `
      *,
      format:formats!matches_format_id_fkey(*),
      creator:profiles!matches_created_by_fkey(*)
    `,
    )
    .eq("id", matchId)
    .single();

  if (matchError) {
    return { success: false, error: matchError.message };
  }

  // Fetch participants with profiles and decks
  const { data: participants, error: participantsError } = await client
    .from("match_participants")
    .select(
      `
      *,
      profile:profiles!match_participants_user_id_fkey(*),
      deck:decks!match_participants_deck_id_fkey(*),
      claimant:profiles!match_participants_claimed_by_fkey(*)
    `,
    )
    .eq("match_id", matchId);

  if (participantsError) {
    return { success: false, error: participantsError.message };
  }

  const matchData = validateMatchData(match.match_data);
  if (!matchData) {
    return { success: false, error: "Invalid match_data format" };
  }

  const mappedParticipants: MatchParticipantWithDetails[] = participants.map(
    (p) => ({
      ...mapMatchParticipantRow(p),
      participantData: validateParticipantData(p.participant_data),
      profile: p.profile ? mapProfileSummary(p.profile) : null,
      deck: p.deck ? mapDeckSummary(p.deck) : null,
      claimant: p.claimant ? mapProfileSummary(p.claimant) : null,
    }),
  );

  return {
    success: true,
    data: {
      ...mapMatchRow(match),
      matchData,
      format: mapFormatSummary(match.format),
      creator: mapProfileSummary(match.creator),
      participants: mappedParticipants,
    },
  };
}

/**
 * Get matches for a user (as participant)
 */
export async function getUserMatches(
  client: SupabaseClient<Database>,
  userId: string,
  pagination: PaginationParams = { page: 1, pageSize: 20 },
): Promise<Result<MatchSummary[]>> {
  const page = pagination.page ?? 1;
  const pageSize = pagination.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  // Get match IDs where user is a participant
  const { data: participantData, error: participantError } = await client
    .from("match_participants")
    .select("match_id")
    .eq("user_id", userId);

  if (participantError) {
    return { success: false, error: participantError.message };
  }

  const matchIds = participantData.map((p) => p.match_id);
  if (matchIds.length === 0) {
    return { success: true, data: [] };
  }

  // Fetch matches with format
  const { data: matches, error: matchesError } = await client
    .from("matches")
    .select(
      `
      *,
      format:formats!matches_format_id_fkey(name, slug)
    `,
    )
    .in("id", matchIds)
    .order("played_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (matchesError) {
    return { success: false, error: matchesError.message };
  }

  // Get participant counts and confirmation status for each match
  const summaryPromises = matches.map(async (match) => {
    const { data: participants } = await client
      .from("match_participants")
      .select("id, is_winner, confirmed_at, user_id, placeholder_name")
      .eq("match_id", match.id);

    const participantCount = participants?.length ?? 0;
    const confirmedCount =
      participants?.filter((p) => p.confirmed_at).length ?? 0;
    const winners = participants?.filter((p) => p.is_winner) ?? [];
    const winnerNames = winners.map((w) => w.placeholder_name ?? "Player");

    return {
      id: match.id,
      formatName: match.format.name,
      formatSlug: match.format.slug as FormatSlug,
      playedAt: match.played_at,
      participantCount,
      confirmedCount,
      winnerNames,
      isFullyConfirmed:
        participantCount > 0 && confirmedCount === participantCount,
    };
  });

  const summaries = await Promise.all(summaryPromises);

  return { success: true, data: summaries };
}

/**
 * Get recent matches (global or by collection)
 */
export async function getRecentMatches(
  client: SupabaseClient<Database>,
  options: { collectionId?: string; limit?: number } = {},
): Promise<Result<MatchSummary[]>> {
  const { collectionId, limit = 10 } = options;

  let matchIds: string[];

  if (collectionId) {
    // Get matches in the collection
    const { data, error } = await client
      .from("collection_matches")
      .select("match_id")
      .eq("collection_id", collectionId)
      .eq("approval_status", "approved");

    if (error) {
      return { success: false, error: error.message };
    }

    matchIds = data.map((m) => m.match_id);
    if (matchIds.length === 0) {
      return { success: true, data: [] };
    }
  } else {
    matchIds = [];
  }

  // Build query
  let query = client
    .from("matches")
    .select(
      `
      *,
      format:formats!matches_format_id_fkey(name, slug)
    `,
    )
    .order("played_at", { ascending: false })
    .limit(limit);

  if (matchIds.length > 0) {
    query = query.in("id", matchIds);
  }

  const { data: matches, error: matchesError } = await query;

  if (matchesError) {
    return { success: false, error: matchesError.message };
  }

  // Get participant info for each match
  const summaryPromises = matches.map(async (match) => {
    const { data: participants } = await client
      .from("match_participants")
      .select("id, is_winner, confirmed_at, user_id, placeholder_name")
      .eq("match_id", match.id);

    const participantCount = participants?.length ?? 0;
    const confirmedCount =
      participants?.filter((p) => p.confirmed_at).length ?? 0;
    const winners = participants?.filter((p) => p.is_winner) ?? [];
    const winnerNames = winners.map((w) => w.placeholder_name ?? "Player");

    return {
      id: match.id,
      formatName: match.format.name,
      formatSlug: match.format.slug as FormatSlug,
      playedAt: match.played_at,
      participantCount,
      confirmedCount,
      winnerNames,
      isFullyConfirmed:
        participantCount > 0 && confirmedCount === participantCount,
    };
  });

  const summaries = await Promise.all(summaryPromises);

  return { success: true, data: summaries };
}

/**
 * Get pending confirmations for a user
 */
export async function getPendingConfirmations(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<Result<MatchWithParticipants[]>> {
  // Get unconfirmed participations
  const { data: participations, error: participationsError } = await client
    .from("match_participants")
    .select("match_id")
    .eq("user_id", userId)
    .is("confirmed_at", null);

  if (participationsError) {
    return { success: false, error: participationsError.message };
  }

  if (participations.length === 0) {
    return { success: true, data: [] };
  }

  const matchIds = participations.map((p) => p.match_id);

  // Fetch full match details for each
  const matchPromises = matchIds.map((id) => getMatchWithDetails(client, id));
  const matchResults = await Promise.all(matchPromises);

  const matches: MatchWithParticipants[] = [];
  for (const result of matchResults) {
    if (result.success) {
      matches.push(result.data);
    }
  }

  return { success: true, data: matches };
}

// ============================================
// Match Mutations
// ============================================

/**
 * Create a new match with participants
 */
export async function createMatch(
  client: SupabaseClient<Database>,
  userId: string,
  payload: CreateMatchPayload,
): Promise<Result<Match>> {
  // Validate team format winner consistency
  const { matchData, participants, winnerIndices } = payload;
  if (matchData.format === "2v2" || matchData.format === "3v3") {
    // Group participants by team
    const teamWinners: Record<string, boolean[]> = {};
    participants.forEach((p, index) => {
      const team = p.team;
      if (team) {
        if (!teamWinners[team]) teamWinners[team] = [];
        teamWinners[team].push(winnerIndices.includes(index));
      }
    });

    // Check that all members of a team have the same winner status
    for (const [team, winStatuses] of Object.entries(teamWinners)) {
      const allSameStatus = winStatuses.every((s) => s === winStatuses[0]);
      if (!allSameStatus) {
        return {
          success: false,
          error: `Team ${team} has inconsistent winner status. All team members must win or lose together.`,
        };
      }
    }
  }

  // Create the match
  const { data: match, error: matchError } = await client
    .from("matches")
    .insert({
      created_by: userId,
      format_id: payload.formatId,
      played_at: payload.playedAt ?? new Date().toISOString(),
      notes: payload.notes ?? null,
      match_data:
        payload.matchData as Database["public"]["Tables"]["matches"]["Insert"]["match_data"],
    })
    .select()
    .single();

  if (matchError) {
    return { success: false, error: matchError.message };
  }

  // Create participants
  const participantInserts = payload.participants.map((p, index) => {
    const isWinner = payload.winnerIndices.includes(index);
    const baseParticipant = {
      match_id: match.id,
      is_winner: isWinner,
      team: p.team ?? null,
      participant_data: getParticipantData(
        payload.matchData,
        index,
      ) as Database["public"]["Tables"]["match_participants"]["Insert"]["participant_data"],
    };

    if (p.type === "registered") {
      return {
        ...baseParticipant,
        user_id: p.userId,
        deck_id: p.deckId,
        placeholder_name: null,
        // Creator auto-confirms their own participation
        confirmed_at: p.userId === userId ? new Date().toISOString() : null,
      };
    } else {
      return {
        ...baseParticipant,
        user_id: null,
        deck_id: null,
        placeholder_name: p.placeholderName,
        confirmed_at: null,
      };
    }
  });

  const { error: participantsError } = await client
    .from("match_participants")
    .insert(participantInserts);

  if (participantsError) {
    // Rollback: delete the match
    await client.from("matches").delete().eq("id", match.id);
    return { success: false, error: participantsError.message };
  }

  return { success: true, data: mapMatchRow(match) };
}

/**
 * Generate participant_data based on match format
 */
function getParticipantData(
  matchData: MatchData,
  index: number,
): ParticipantData {
  switch (matchData.format) {
    case "ffa":
    case "1v1":
      return { format: matchData.format };

    case "2v2":
    case "3v3":
      // Assign to teams in order (first half team A, second half team B)
      const playersPerTeam = matchData.format === "2v2" ? 2 : 3;
      const teamId = index < playersPerTeam ? "A" : "B";
      return { format: matchData.format, teamId };

    case "pentagram": {
      const seatPosition = index as 0 | 1 | 2 | 3 | 4;
      const allies = PENTAGRAM_ADJACENCY_MAP[seatPosition];
      const enemies = getPentagramEnemies(seatPosition);
      return {
        format: "pentagram",
        seatPosition,
        targetParticipantIds: [
          matchData.seatingOrder[enemies[0]],
          matchData.seatingOrder[enemies[1]],
        ],
        allyParticipantIds: [
          matchData.seatingOrder[allies[0]],
          matchData.seatingOrder[allies[1]],
        ],
      };
    }
  }
}

/**
 * Confirm match participation
 */
export async function confirmMatchParticipation(
  client: SupabaseClient<Database>,
  participantId: string
): Promise<Result<MatchParticipant>> {
  const { data, error } = await client
    .from('match_participants')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('id', participantId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapMatchParticipantRow(data),
      participantData: validateParticipantData(data.participant_data),
    },
  }
}

/**
 * Reject/dispute a match participation
 */
export async function disputeMatchParticipation(
  client: SupabaseClient<Database>,
  participantId: string
): Promise<Result<null>> {
  // For now, we just remove the confirmation
  // In the future, this could flag the match for review
  const { error } = await client
    .from('match_participants')
    .update({ confirmed_at: null })
    .eq('id', participantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Update a participant's deck selection
 * Used during match confirmation if the user didn't have a deck assigned
 */
export async function updateParticipantDeck(
  client: SupabaseClient<Database>,
  participantId: string,
  deckId: string
): Promise<Result<null>> {
  const { error } = await client
    .from('match_participants')
    .update({ deck_id: deckId })
    .eq('id', participantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}

/**
 * Search for matches with claimable placeholder slots
 * Uses fuzzy matching (ILIKE) on placeholder_name
 */
export async function searchClaimableMatches(
  client: SupabaseClient<Database>,
  searchName: string
): Promise<Result<ClaimableMatchSlot[]>> {
  // Search for placeholder slots matching the name
  const { data: participants, error } = await client
    .from('match_participants')
    .select(`
      id,
      match_id,
      placeholder_name,
      match:matches!inner (
        id,
        played_at,
        created_by,
        format:formats!inner (
          slug,
          name
        ),
        creator:profiles!matches_created_by_fkey (
          username
        )
      )
    `)
    .is('user_id', null)
    .eq('claim_status', 'none')
    .ilike('placeholder_name', `%${searchName}%`)
    .order('match_id')
    .limit(20)

  if (error) {
    return { success: false, error: error.message }
  }

  if (!participants || participants.length === 0) {
    return { success: true, data: [] }
  }

  // Get all match IDs to fetch other participants for context
  const matchIds = [...new Set(participants.map((p) => p.match_id))]

  const { data: allParticipants, error: partError } = await client
    .from('match_participants')
    .select(`
      match_id,
      placeholder_name,
      user:profiles!match_participants_user_id_fkey (
        username
      )
    `)
    .in('match_id', matchIds)

  if (partError) {
    return { success: false, error: partError.message }
  }

  // Group other participants by match for context
  const participantsByMatch = new Map<string, string[]>()
  for (const p of allParticipants || []) {
    const name = p.user?.username || p.placeholder_name || 'Unknown'
    const existing = participantsByMatch.get(p.match_id) || []
    existing.push(name)
    participantsByMatch.set(p.match_id, existing)
  }

  // Map to ClaimableMatchSlot
  const results: ClaimableMatchSlot[] = participants.map((p) => {
    const match = p.match as {
      id: string
      played_at: string
      created_by: string
      format: { slug: string; name: string }
      creator: { username: string }
    }
    const otherParticipants = (participantsByMatch.get(p.match_id) || [])
      .filter((name) => name !== p.placeholder_name)

    return {
      participantId: p.id,
      matchId: p.match_id,
      placeholderName: p.placeholder_name || 'Unknown',
      match: {
        id: match.id,
        playedAt: match.played_at,
        formatSlug: match.format.slug as FormatSlug,
        formatName: match.format.name,
        creatorUsername: match.creator.username,
        creatorDisplayName: null, // Profiles don't have display_name
        otherParticipants,
      },
    }
  })

  return { success: true, data: results }
}
/**
 * Claim a placeholder slot
 */
export async function claimPlaceholderSlot(
  client: SupabaseClient<Database>,
  participantId: string,
  userId: string
): Promise<Result<MatchParticipant>> {
  const { data, error } = await client
    .from('match_participants')
    .update({
      claimed_by: userId,
      claim_status: 'pending',
    })
    .eq('id', participantId)
    .is('user_id', null) // Only placeholders
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapMatchParticipantRow(data),
      participantData: validateParticipantData(data.participant_data),
    },
  }
}

/**
 * Approve a claim on a placeholder slot
 */
export async function approveSlotClaim(
  client: SupabaseClient<Database>,
  participantId: string
): Promise<Result<MatchParticipant>> {
  // First get the claimed_by user
  const { data: participant, error: fetchError } = await client
    .from('match_participants')
    .select('claimed_by')
    .eq('id', participantId)
    .single()

  if (fetchError || !participant.claimed_by) {
    return { success: false, error: 'No pending claim found' }
  }

  // Update to approve and transfer ownership
  const { data, error } = await client
    .from('match_participants')
    .update({
      user_id: participant.claimed_by,
      claim_status: 'approved',
      placeholder_name: null,
    })
    .eq('id', participantId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapMatchParticipantRow(data),
      participantData: validateParticipantData(data.participant_data),
    },
  }
}

/**
 * Reject a claim on a placeholder slot
 * Resets status to 'none' so other users can still claim
 */
export async function rejectSlotClaim(
  client: SupabaseClient<Database>,
  participantId: string
): Promise<Result<MatchParticipant>> {
  const { data, error } = await client
    .from('match_participants')
    .update({
      claimed_by: null,
      claim_status: 'none', // Reset to allow other users to claim
    })
    .eq('id', participantId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapMatchParticipantRow(data),
      participantData: validateParticipantData(data.participant_data),
    },
  }
}

/**
 * Delete a match (only by creator, before any confirmations)
 */
export async function deleteMatch(
  client: SupabaseClient<Database>,
  matchId: string,
  userId: string
): Promise<Result<null>> {
  // Verify user is creator and no confirmations exist
  const { data: match, error: matchError } = await client
    .from('matches')
    .select('created_by')
    .eq('id', matchId)
    .single()

  if (matchError || match.created_by !== userId) {
    return { success: false, error: 'Only the match creator can delete' }
  }

  // Check for confirmations
  const { count, error: countError } = await client
    .from('match_participants')
    .select('*', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .not('confirmed_at', 'is', null)

  if (countError) {
    return { success: false, error: countError.message }
  }

  if (count && count > 0) {
    return { success: false, error: 'Cannot delete a match with confirmed participants' }
  }

  // Delete participants first (due to FK constraint)
  await client.from('match_participants').delete().eq('match_id', matchId)

  // Delete the match
  const { error } = await client.from('matches').delete().eq('id', matchId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: null }
}
