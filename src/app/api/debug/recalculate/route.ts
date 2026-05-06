/**
 * Debug API Route: Rating Recalculation
 * 
 * DEV ONLY - Provides visibility into dirty matches and allows manual recalculation.
 * 
 * GET  /api/debug/recalculate       - List dirty matches
 * POST /api/debug/recalculate       - Trigger recalculation for all dirty matches
 * POST /api/debug/recalculate?id=X  - Trigger recalculation for specific match
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { calculateRating, ALGORITHM_VERSION } from "@/lib/rating";
import type { Bracket } from "@/types/common";

export const dynamic = "force-dynamic";

// Block in production
function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}

type MatchParticipant = {
  participant_id: string;
  user_id: string;
  deck_id: string | null;
  deck_bracket: number;
  is_winner: boolean;
  team: string | null;
};

/**
 * GET /api/debug/recalculate - List dirty matches with details
 */
export async function GET(request: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("id");

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log(`[DEBUG] GET /api/debug/recalculate called by ${user.id}`);

  // If specific match ID provided, get details for that match
  if (matchId) {
    return getMatchDetails(supabase, matchId);
  }

  // Get all dirty matches
  const { data: dirtyMatches, error: dirtyError } = await supabase
    .from("matches")
    .select(`
      id,
      format_id,
      played_at,
      created_by,
      is_dirty,
      ratings_applied_at,
      format:formats(name, slug)
    `)
    .eq("is_dirty", true)
    .order("played_at", { ascending: true })
    .limit(50);

  if (dirtyError) {
    console.error(`[DEBUG] Failed to get dirty matches: ${dirtyError.message}`);
    return NextResponse.json({ error: dirtyError.message }, { status: 500 });
  }

  console.log(`[DEBUG] Found ${dirtyMatches?.length ?? 0} dirty matches`);

  return NextResponse.json({
    dirty_matches: dirtyMatches ?? [],
    count: dirtyMatches?.length ?? 0,
    message: "Use POST to trigger recalculation, or GET ?id=<match_id> for match details",
  });
}

/**
 * Get detailed info about a specific match for debugging
 */
async function getMatchDetails(supabase: Awaited<ReturnType<typeof createClient>>, matchId: string) {
  console.log(`[DEBUG] Getting details for match ${matchId}`);

  // Get match info
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(`
      id,
      format_id,
      played_at,
      created_by,
      is_dirty,
      ratings_applied_at,
      format:formats(name, slug)
    `)
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Get participants with deck info (using same join as recalc)
  const { data: participants, error: partError } = await supabase
    .from("match_participants")
    .select(`
      id,
      user_id,
      deck_id,
      is_winner,
      confirmed_at,
      deck:decks(id, name, bracket)
    `)
    .eq("match_id", matchId);

  if (partError) {
    console.error(`[DEBUG] Failed to get participants: ${partError.message}`);
  }

  // Get rating history for this match
  const { data: ratingHistory, error: historyError } = await supabase
    .from("rating_history")
    .select(`
      id,
      user_id,
      rating_before,
      rating_after,
      delta,
      is_win,
      player_bracket,
      opponent_avg_bracket,
      opponent_avg_rating,
      k_factor,
      algorithm_version,
      collection_id
    `)
    .eq("match_id", matchId);

  if (historyError) {
    console.error(`[DEBUG] Failed to get rating history: ${historyError.message}`);
  }

  // Format participant info with deck brackets
  const participantDetails = (participants ?? []).map((p) => {
    const deck = p.deck as { id: string; name: string; bracket: number } | null;
    const history = (ratingHistory ?? []).find(
      (h) => h.user_id === p.user_id && h.collection_id === null
    );

    return {
      participant_id: p.id,
      user_id: p.user_id,
      deck_id: p.deck_id,
      deck_name: deck?.name ?? "No deck",
      deck_bracket_current: deck?.bracket ?? null,
      is_winner: p.is_winner,
      confirmed: !!p.confirmed_at,
      rating_history: history
        ? {
            rating_before: history.rating_before,
            rating_after: history.rating_after,
            delta: history.delta,
            player_bracket_recorded: history.player_bracket,
            opponent_avg_bracket: history.opponent_avg_bracket,
            k_factor: history.k_factor,
          }
        : null,
      bracket_mismatch:
        history && deck
          ? history.player_bracket !== deck.bracket
          : false,
    };
  });

  return NextResponse.json({
    match: {
      id: match.id,
      format: match.format,
      played_at: match.played_at,
      is_dirty: match.is_dirty,
      ratings_applied_at: match.ratings_applied_at,
    },
    participants: participantDetails,
    has_bracket_mismatch: participantDetails.some((p) => p.bracket_mismatch),
    rating_history_count: ratingHistory?.length ?? 0,
  });
}

/**
 * POST /api/debug/recalculate - Trigger recalculation
 */
export async function POST(request: Request) {
  if (!isDevEnvironment()) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("id");

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log(`[DEBUG] POST /api/debug/recalculate called by ${user.id}${matchId ? ` for match ${matchId}` : " for all dirty matches"}`);

  // Get dirty matches to process
  let query = supabase
    .from("matches")
    .select("id, format_id, played_at, created_by, is_dirty")
    .eq("is_dirty", true);

  if (matchId) {
    query = query.eq("id", matchId);
  }

  const { data: dirtyMatches, error: dirtyError } = await query
    .order("played_at", { ascending: true })
    .limit(matchId ? 1 : 50);

  if (dirtyError) {
    return NextResponse.json({ error: dirtyError.message }, { status: 500 });
  }

  if (!dirtyMatches || dirtyMatches.length === 0) {
    return NextResponse.json({
      message: matchId
        ? `Match ${matchId} is not marked as dirty`
        : "No dirty matches to process",
      processed: 0,
    });
  }

  console.log(`[DEBUG] Processing ${dirtyMatches.length} dirty matches`);

  const results: Array<{
    match_id: string;
    success: boolean;
    participants_updated: number;
    error?: string;
    details?: Array<{
      user_id: string;
      old_delta: number;
      new_delta: number;
      delta_change: number;
      bracket_used: number;
    }>;
  }> = [];

  for (const match of dirtyMatches) {
    const result = await recalculateMatchWithDetails(supabase, match);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    message: `Processed ${results.length} matches`,
    successful,
    failed,
    results,
  });
}

/**
 * Recalculate a single match and return detailed results
 */
async function recalculateMatchWithDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  match: { id: string; format_id: string; played_at: string }
) {
  const result: {
    match_id: string;
    success: boolean;
    participants_updated: number;
    error?: string;
    details?: Array<{
      user_id: string;
      old_delta: number;
      new_delta: number;
      delta_change: number;
      bracket_used: number;
    }>;
  } = {
    match_id: match.id,
    success: false,
    participants_updated: 0,
    details: [],
  };

  try {
    console.log(`[DEBUG] Recalculating match ${match.id}`);

    // Get participants with current deck brackets
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: participantsRaw, error: partError } = await (supabase as any).rpc(
      "get_match_participants_for_recalc",
      { p_match_id: match.id }
    );

    if (partError) {
      result.error = `Failed to get participants: ${partError.message}`;
      console.error(`[DEBUG] ${result.error}`);
      return result;
    }

    const participants = (participantsRaw as MatchParticipant[]) ?? [];
    console.log(`[DEBUG] Found ${participants.length} participants`);

    if (participants.length === 0) {
      result.success = true;
      result.error = "No participants to recalculate";
      return result;
    }

    // Log participant brackets
    for (const p of participants) {
      console.log(`[DEBUG]   - user=${p.user_id}, deck=${p.deck_id}, bracket=${p.deck_bracket}`);
    }

    // Get existing rating history for comparison
    const { data: existingHistory } = await supabase
      .from("rating_history")
      .select("user_id, delta, rating_before, rating_after")
      .eq("match_id", match.id)
      .is("collection_id", null);

    const existingByUser = new Map(
      (existingHistory ?? []).map((h) => [h.user_id, h])
    );

    // Get current ratings for all participants
    const participantRatings = new Map<string, { rating: number; matchesPlayed: number }>();
    for (const p of participants) {
      const { data: rating } = await supabase
        .from("ratings")
        .select("rating, matches_played")
        .eq("user_id", p.user_id)
        .eq("format_id", match.format_id)
        .is("collection_id", null)
        .single();

      participantRatings.set(p.user_id, {
        rating: rating?.rating ?? 1000,
        matchesPlayed: rating?.matches_played ?? 0,
      });
    }

    // Get ratings BEFORE this match for each participant
    const ratingsBefore = new Map<string, number>();
    for (const p of participants) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ratingBefore } = await (supabase as any).rpc("get_rating_before_match", {
        p_user_id: p.user_id,
        p_format_id: match.format_id,
        p_collection_id: null,
        p_match_played_at: match.played_at,
      });
      ratingsBefore.set(p.user_id, ratingBefore ?? 1000);
    }

    // Calculate new deltas for each participant
    for (const participant of participants) {
      const ratingBefore = ratingsBefore.get(participant.user_id) ?? 1000;
      const currentRating = participantRatings.get(participant.user_id);
      const matchCountBefore = (currentRating?.matchesPlayed ?? 1) - 1;

      // Build opponents array
      const opponents = participants
        .filter((p) => p.participant_id !== participant.participant_id)
        .map((p) => ({
          rating: ratingsBefore.get(p.user_id) ?? 1000,
          bracket: p.deck_bracket as Bracket,
        }));

      if (opponents.length === 0) continue;

      // Calculate new rating
      const calcResult = calculateRating({
        playerId: participant.user_id,
        playerRating: ratingBefore,
        playerBracket: participant.deck_bracket as Bracket,
        playerMatchCount: matchCountBefore,
        isWinner: participant.is_winner,
        opponents,
        formatId: match.format_id,
        collectionId: null,
      });

      const existing = existingByUser.get(participant.user_id);
      const oldDelta = existing?.delta ?? 0;
      const deltaChange = calcResult.delta - oldDelta;

      console.log(`[DEBUG] User ${participant.user_id}: bracket=${participant.deck_bracket}, oldDelta=${oldDelta}, newDelta=${calcResult.delta}, change=${deltaChange}`);

      result.details!.push({
        user_id: participant.user_id,
        old_delta: oldDelta,
        new_delta: calcResult.delta,
        delta_change: deltaChange,
        bracket_used: participant.deck_bracket,
      });

      // Update rating_history via upsert
      const newRatingAfter = ratingBefore + calcResult.delta;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase as any).rpc("upsert_rating_history", {
        p_user_id: participant.user_id,
        p_match_id: match.id,
        p_format_id: match.format_id,
        p_collection_id: null,
        p_rating_before: ratingBefore,
        p_rating_after: newRatingAfter,
        p_delta: calcResult.delta,
        p_is_win: participant.is_winner,
        p_player_bracket: participant.deck_bracket,
        p_opponent_avg_rating: calcResult.opponentAvgRating,
        p_opponent_avg_bracket: calcResult.opponentAvgBracket,
        p_k_factor: calcResult.kFactor,
        p_algorithm_version: ALGORITHM_VERSION,
      });

      if (upsertError) {
        console.error(`[DEBUG] Failed to upsert history: ${upsertError.message}`);
        continue;
      }

      // Adjust current rating if delta changed
      if (deltaChange !== 0) {
        const newCurrentRating = (currentRating?.rating ?? 1000) + deltaChange;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any).rpc("update_user_rating", {
          p_user_id: participant.user_id,
          p_format_id: match.format_id,
          p_collection_id: null,
          p_new_rating: newCurrentRating,
          p_adjust_matches: 0,
          p_adjust_wins: 0,
        });

        if (updateError) {
          console.error(`[DEBUG] Failed to update rating: ${updateError.message}`);
        }
      }

      result.participants_updated++;
    }

    // Clear dirty flag
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clearError } = await (supabase as any).rpc("clear_match_dirty_flag", {
      p_match_id: match.id,
    });

    if (clearError) {
      result.error = `Failed to clear dirty flag: ${clearError.message}`;
      console.error(`[DEBUG] ${result.error}`);
    } else {
      result.success = true;
      console.log(`[DEBUG] Match ${match.id} recalculation complete`);
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Unknown error";
    console.error(`[DEBUG] Exception: ${result.error}`);
  }

  return result;
}
