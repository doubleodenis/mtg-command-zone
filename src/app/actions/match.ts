'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  updateParticipantDeck,
  claimPlaceholderSlot,
  approveSlotClaim,
  rejectSlotClaim,
  searchClaimableMatches,
  createMatch,
} from "@/lib/supabase/matches";
import {
  getRating,
  applyRatingChange,
  updateCollectionRatings,
} from "@/lib/supabase/ratings";
import {
  getMatchCollections,
  getUserMemberCollections,
  addMatchToCollection,
  getCollectionById,
  isCollectionMember,
} from "@/lib/supabase/collections";
import { getFriendshipStatus } from "@/lib/supabase/profiles";
import { calculateRating } from "@/lib/rating";
import type {
  Result,
  Bracket,
  ClaimableMatchSlot,
  ClaimStatus,
  CreateMatchPayload,
  MatchData,
  ParticipantInput,
  ApprovalStatus,
  ParticipantStatus,
} from "@/types";

/**
 * Log a new match with participants.
 *
 * This action:
 * 1. Creates the match and participant records
 * 2. Auto-confirms all real participants
 * 3. Calculates and APPLIES ratings immediately
 * 4. Returns the actual rating delta for creator
 *
 * Winner cannot be changed after match creation.
 * Deck updates are allowed but will trigger nightly recalculation.
 */
export async function logMatch(payload: {
  formatId: string;
  playedAt?: string;
  notes?: string | null;
  matchData: MatchData;
  participants: ParticipantInput[];
  winnerIndices: number[];
  collectionIds?: string[];
}): Promise<Result<{ matchId: string; delta: number }>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Create match via the supabase helper
  const matchResult = await createMatch(
    supabase,
    user.id,
    payload as CreateMatchPayload,
  );
  if (!matchResult.success) {
    return { success: false, error: matchResult.error };
  }

  const match = matchResult.data;
  console.log(
    `[RATING] logMatch: Match ${match.id} created, starting rating calculations`,
  );
  const now = new Date().toISOString();

  // Get all real participants (not placeholders)
  const { data: participants, error: participantsError } = await supabase
    .from("match_participants")
    .select(
      `
      id,
      user_id,
      is_winner,
      deck:decks!match_participants_deck_id_fkey(id, bracket)
    `,
    )
    .eq("match_id", match.id)
    .not("user_id", "is", null);

  if (participantsError) {
    return {
      success: false,
      error: `Failed to fetch participants: ${participantsError.message}`,
    };
  }

  const realParticipants = participants ?? [];

  // Auto-confirm all real participants
  for (const p of realParticipants) {
    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: now,
      })
      .eq("id", p.id);
  }

  // Get format info
  const { data: format, error: formatError } = await supabase
    .from("formats")
    .select("id")
    .eq("id", payload.formatId)
    .single();

  if (formatError || !format) {
    revalidatePath("/matches");
    revalidatePath(`/match/${match.id}`);
    return { success: true, data: { matchId: match.id, delta: 0 } };
  }

  // Build participant ratings map (snapshot BEFORE applying any changes)
  const participantRatings: Map<
    string,
    { rating: number; matchesPlayed: number }
  > = new Map();

  for (const p of realParticipants) {
    if (p.user_id) {
      const ratingResult = await getRating(supabase, p.user_id, format.id);
      if (ratingResult.success) {
        participantRatings.set(p.user_id, ratingResult.data);
      } else {
        participantRatings.set(p.user_id, { rating: 1000, matchesPlayed: 0 });
      }
    }
  }

  // Calculate and apply ratings for each real participant
  let creatorDelta = 0;

  for (const participant of realParticipants) {
    if (!participant.user_id) continue;

    const currentRating = participantRatings.get(participant.user_id)!;
    const playerBracket: Bracket = (participant.deck?.bracket as Bracket) ?? 2;

    // Build opponents array (excluding this participant)
    const opponents: Array<{ rating: number; bracket: Bracket }> = [];
    for (const p of realParticipants) {
      if (p.user_id && p.user_id !== participant.user_id) {
        const oppRating = participantRatings.get(p.user_id)!.rating;
        const bracket: Bracket = (p.deck?.bracket as Bracket) ?? 2;
        opponents.push({ rating: oppRating, bracket });
      }
    }

    // Calculate rating change
    const ratingCalc = calculateRating({
      playerId: participant.user_id,
      playerRating: currentRating.rating,
      playerBracket,
      playerMatchCount: currentRating.matchesPlayed,
      isWinner: participant.is_winner,
      opponents,
      formatId: format.id,
      collectionId: null,
    });

    // Apply global rating change
    const newRating = currentRating.rating + ratingCalc.delta;
    console.log(
      `[RATING] logMatch: Applying rating for user ${participant.user_id} - before: ${currentRating.rating}, delta: ${ratingCalc.delta}, after: ${newRating}, isWinner: ${participant.is_winner}`,
    );
    await applyRatingChange(supabase, {
      userId: participant.user_id,
      matchId: match.id,
      formatId: format.id,
      newRating,
      delta: ratingCalc.delta,
      isWin: participant.is_winner,
      playerBracket,
      opponentAvgRating: ratingCalc.opponentAvgRating,
      opponentAvgBracket: ratingCalc.opponentAvgBracket,
      kFactor: ratingCalc.kFactor,
      algorithmVersion: 1,
    });

    // Track creator's delta for return value
    if (participant.user_id === user.id) {
      creatorDelta = ratingCalc.delta;
    }

    // Update collection-scoped ratings
    const matchCollectionsResult = await getMatchCollections(
      supabase,
      match.id,
    );
    if (
      matchCollectionsResult.success &&
      matchCollectionsResult.data.length > 0
    ) {
      const userMemberCollectionsResult = await getUserMemberCollections(
        supabase,
        participant.user_id,
        matchCollectionsResult.data,
      );

      if (
        userMemberCollectionsResult.success &&
        userMemberCollectionsResult.data.length > 0
      ) {
        console.log(
          `[RATING] logMatch: Applying collection-scoped ratings for user ${participant.user_id} in ${userMemberCollectionsResult.data.length} collections`,
        );
        await updateCollectionRatings(supabase, {
          userId: participant.user_id,
          matchId: match.id,
          formatId: format.id,
          playerBracket,
          isWinner: participant.is_winner,
          opponents,
          collectionIds: userMemberCollectionsResult.data,
          algorithmVersion: 1,
        });
      }
    }
  }

  // Mark match as ratings applied immediately
  console.log(
    `[RATING] logMatch: Setting ratings_applied_at for match ${match.id}`,
  );
  const { error: applyError } = await supabase
    .from("matches")
    .update({
      ratings_applied_at: now,
      is_dirty: false,
    })
    .eq("id", match.id);

  if (applyError) {
    console.error(`[RATING] logMatch: FAILED to set ratings_applied_at - ${applyError.message}`);
  } else {
    console.log(`[RATING] logMatch: Successfully set ratings_applied_at for match ${match.id}`);
  }

  // Add match to selected collections
  if (payload.collectionIds && payload.collectionIds.length > 0) {
    for (const collectionId of payload.collectionIds) {
      // Verify user is a member of the collection
      const memberCheck = await isCollectionMember(
        supabase,
        collectionId,
        user.id,
      );
      if (!memberCheck.success || !memberCheck.data) {
        continue; // Skip collections the user is not a member of
      }

      // Get collection details for permission check
      const collectionResult = await getCollectionById(supabase, collectionId);
      if (!collectionResult.success) {
        continue;
      }

      const collection = collectionResult.data;
      const isOwner = collection.ownerId === user.id;
      const permission = collection.matchAddPermission;

      // Check permissions
      if (permission === "owner_only" && !isOwner) {
        continue; // User doesn't have permission
      }

      // Determine approval status
      let approvalStatus: ApprovalStatus = "approved";
      if (!isOwner && permission === "any_member_approval_required") {
        approvalStatus = "pending";
      }

      // Add match to collection
      await addMatchToCollection(
        supabase,
        collectionId,
        match.id,
        user.id,
        approvalStatus,
      );
      revalidatePath(`/collections/${collectionId}`);
    }
  }

  // Revalidate pages
  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${match.id}`);

  return {
    success: true,
    data: {
      matchId: match.id,
      delta: creatorDelta,
    },
  };
}

/**
 * Update participant's deck (and confirm if not already confirmed).
 *
 * Since ratings are now applied immediately on match creation,
 * this function is primarily for:
 * 1. Updating deck selection (triggers dirty flag for recalculation)
 * 2. Confirming participation if somehow still pending
 *
 * Returns the participant's current rating delta from the match.
 */
export async function confirmMatch(
  participantId: string,
  deckId?: string,
): Promise<Result<{ delta: number }>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the participant record with match info
  const { data: participant, error: participantError } = await supabase
    .from("match_participants")
    .select(
      `
      id,
      user_id,
      match_id,
      is_winner,
      confirmed_at,
      participant_status,
      deck_id,
      deck:decks!match_participants_deck_id_fkey(bracket),
      match:matches!inner(format_id, ratings_applied_at)
    `,
    )
    .eq("id", participantId)
    .single();

  if (participantError || !participant) {
    return { success: false, error: "Participant not found" };
  }

  // Verify this is the user's participation
  if (participant.user_id !== user.id) {
    return {
      success: false,
      error: "You can only update your own participation",
    };
  }

  const matchInfo = participant.match as {
    format_id: string;
    ratings_applied_at: string | null;
  };

  // If deck provided, update it (this triggers dirty flag if ratings already applied)
  if (deckId && deckId !== participant.deck_id) {
    const updateResult = await updateParticipantDeck(
      supabase,
      participantId,
      deckId,
    );
    if (!updateResult.success) {
      return { success: false, error: updateResult.error };
    }
  }

  // If still pending (edge case), mark as confirmed
  if (participant.participant_status === "pending") {
    await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId);
  }

  // Get the actual delta from rating_history (if ratings were applied)
  let delta = 0;
  if (matchInfo.ratings_applied_at) {
    const { data: historyEntry } = await supabase
      .from("rating_history")
      .select("delta")
      .eq("user_id", user.id)
      .eq("match_id", participant.match_id)
      .eq("format_id", matchInfo.format_id)
      .is("collection_id", null)
      .single();

    delta = historyEntry?.delta ?? 0;
  }

  // Revalidate relevant pages
  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/notifications");

  return {
    success: true,
    data: { delta },
  };
}

/**
 * Apply ratings for a match when the lock window has expired.
 *
 * This is called by a cron job / edge function when locks_at has passed.
 * It:
 * 1. Gets all confirmed participants (status = 'confirmed' or 'auto_confirmed')
 * 2. Calculates and applies rating changes for each
 * 3. Updates collection-scoped ratings
 * 4. Marks the match as ratings_applied_at
 *
 * Placeholders are excluded from rating calculations.
 */
export async function applyMatchRatings(
  matchId: string,
): Promise<Result<{ appliedCount: number }>> {
  const supabase = await createClient();

  // Get current user (for admin/cron context verification if needed)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the match with all details
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(
      `
      id,
      format_id,
      locks_at,
      ratings_applied_at,
      is_dirty,
      created_by
    `,
    )
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { success: false, error: "Match not found" };
  }

  // Only allow if user is match creator (for manual trigger) or in future: admin
  if (match.created_by !== user.id) {
    return {
      success: false,
      error: "Only match creator can trigger rating application",
    };
  }

  // Check if ratings already applied
  if (match.ratings_applied_at) {
    return { success: false, error: "Ratings have already been applied" };
  }

  // Check if lock window has actually passed
  if (match.locks_at) {
    const locksAt = new Date(match.locks_at);
    const now = new Date();
    if (now < locksAt) {
      return { success: false, error: "Lock window has not expired yet" };
    }
  }

  // Get all participants
  const { data: participants, error: participantsError } = await supabase
    .from("match_participants")
    .select(
      `
      id,
      user_id,
      is_winner,
      participant_status,
      deck:decks!match_participants_deck_id_fkey(id, bracket)
    `,
    )
    .eq("match_id", matchId);

  if (participantsError || !participants) {
    return { success: false, error: "Failed to fetch participants" };
  }

  // Filter to only real users (not placeholders)
  const realParticipants = participants.filter((p) => p.user_id !== null);

  // Auto-confirm any pending participants (they didn't confirm within window)
  for (const p of realParticipants) {
    if (p.participant_status === "pending") {
      await supabase
        .from("match_participants")
        .update({
          participant_status: "auto_confirmed" as ParticipantStatus,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", p.id);
    }
  }

  // Build opponent map for rating calculations
  const participantRatings: Map<
    string,
    { rating: number; matchesPlayed: number }
  > = new Map();

  for (const p of realParticipants) {
    if (p.user_id) {
      const ratingResult = await getRating(
        supabase,
        p.user_id,
        match.format_id,
      );
      if (ratingResult.success) {
        participantRatings.set(p.user_id, ratingResult.data);
      } else {
        participantRatings.set(p.user_id, { rating: 1000, matchesPlayed: 0 });
      }
    }
  }

  // Calculate and apply ratings for each real participant
  let appliedCount = 0;

  for (const participant of realParticipants) {
    if (!participant.user_id) continue;

    const currentRating = participantRatings.get(participant.user_id)!;
    const playerBracket: Bracket = (participant.deck?.bracket as Bracket) ?? 2;

    // Build opponents array (excluding this participant and placeholders)
    const opponents: Array<{ rating: number; bracket: Bracket }> = [];
    for (const p of realParticipants) {
      if (p.user_id && p.user_id !== participant.user_id) {
        const oppRating = participantRatings.get(p.user_id)!.rating;
        const bracket: Bracket = (p.deck?.bracket as Bracket) ?? 2;
        opponents.push({ rating: oppRating, bracket });
      }
    }

    // Calculate rating change
    const ratingCalc = calculateRating({
      playerId: participant.user_id,
      playerRating: currentRating.rating,
      playerBracket,
      playerMatchCount: currentRating.matchesPlayed,
      isWinner: participant.is_winner,
      opponents,
      formatId: match.format_id,
      collectionId: null,
    });

    // Apply global rating change
    const newRating = currentRating.rating + ratingCalc.delta;
    const applyResult = await applyRatingChange(supabase, {
      userId: participant.user_id,
      matchId: match.id,
      formatId: match.format_id,
      newRating,
      delta: ratingCalc.delta,
      isWin: participant.is_winner,
      playerBracket,
      opponentAvgRating: ratingCalc.opponentAvgRating,
      opponentAvgBracket: ratingCalc.opponentAvgBracket,
      kFactor: ratingCalc.kFactor,
      algorithmVersion: 1,
    });

    if (applyResult.success) {
      appliedCount++;

      // Update collection-scoped ratings
      const matchCollectionsResult = await getMatchCollections(
        supabase,
        match.id,
      );
      if (
        matchCollectionsResult.success &&
        matchCollectionsResult.data.length > 0
      ) {
        const userMemberCollectionsResult = await getUserMemberCollections(
          supabase,
          participant.user_id,
          matchCollectionsResult.data,
        );

        if (
          userMemberCollectionsResult.success &&
          userMemberCollectionsResult.data.length > 0
        ) {
          await updateCollectionRatings(supabase, {
            userId: participant.user_id,
            matchId: match.id,
            formatId: match.format_id,
            playerBracket,
            isWinner: participant.is_winner,
            opponents,
            collectionIds: userMemberCollectionsResult.data,
            algorithmVersion: 1,
          });
        }
      }
    }
  }

  // Mark match as ratings applied
  const { error: updateError } = await supabase
    .from("matches")
    .update({
      ratings_applied_at: new Date().toISOString(),
      is_dirty: false, // Reset dirty flag since we just applied
      last_recalculated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (updateError) {
    return {
      success: false,
      error: `Failed to mark match: ${updateError.message}`,
    };
  }

  // Revalidate pages
  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${matchId}`);

  return {
    success: true,
    data: { appliedCount },
  };
}

/**
 * Edit match details.
 *
 * Allowed edits:
 * - notes: Always editable
 * - played_at: Always editable (subject to backdate limit)
 *
 * Note: Winner, format, and participants cannot be changed after match creation.
 */
export async function editMatch(
  matchId: string,
  updates: {
    notes?: string | null;
    playedAt?: string;
  },
): Promise<Result<null>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get match details
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id, created_by, ratings_applied_at")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return { success: false, error: "Match not found" };
  }

  // Only match creator can edit
  if (match.created_by !== user.id) {
    return {
      success: false,
      error: "Only the match creator can edit match details",
    };
  }

  // Build update object
  const updateData: Record<string, unknown> = {};

  if (updates.notes !== undefined) {
    updateData.notes = updates.notes;
  }

  if (updates.playedAt !== undefined) {
    // Validate played_at against backdate limit
    const { data: settings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "match_settings")
      .single();

    const matchSettings = settings?.value as { backdate_limit_days?: number } | null;
    const backdateLimitDays = matchSettings?.backdate_limit_days ?? 30;
    const backdateLimit = new Date();
    backdateLimit.setDate(backdateLimit.getDate() - backdateLimitDays);

    const playedAt = new Date(updates.playedAt);
    if (playedAt < backdateLimit) {
      return {
        success: false,
        error: `Match date cannot be more than ${backdateLimitDays} days in the past`,
      };
    }

    if (playedAt > new Date()) {
      return { success: false, error: "Match date cannot be in the future" };
    }

    updateData.played_at = updates.playedAt;

    // If ratings already applied and played_at changed, mark dirty for recalculation
    // (because rating history is date-ordered)
    if (match.ratings_applied_at) {
      console.log(
        `[RATING] updateMatchMetadata: Setting is_dirty=true for match ${matchId} (played_at changed post-rating)`,
      );
      updateData.is_dirty = true;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No valid updates provided" };
  }

  // Apply updates
  const { error: updateError } = await supabase
    .from("matches")
    .update(updateData)
    .eq("id", matchId);

  if (updateError) {
    console.error(`[RATING] editMatch: FAILED to update match ${matchId} - ${updateError.message}`);
    return {
      success: false,
      error: `Failed to update: ${updateError.message}`,
    };
  }

  if (updateData.is_dirty) {
    console.log(`[RATING] editMatch: Successfully set is_dirty=true for match ${matchId}`);
  }

  // Revalidate pages
  revalidatePath(`/match/${matchId}`);
  revalidatePath("/matches");

  return { success: true, data: null };
}

// ============================================
// Claim System Actions
// ============================================

/**
 * Search for matches with claimable placeholder slots
 */
export async function searchForClaimableMatches(
  searchName: string,
): Promise<Result<ClaimableMatchSlot[]>> {
  if (!searchName || searchName.trim().length < 2) {
    return {
      success: false,
      error: "Search name must be at least 2 characters",
    };
  }

  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  return searchClaimableMatches(supabase, searchName.trim());
}

/**
 * Submit a claim request for a placeholder slot
 */
export async function submitClaimRequest(
  participantId: string,
): Promise<Result<null>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the slot is claimable
  const { data: participant, error: fetchError } = await supabase
    .from("match_participants")
    .select("id, match_id, user_id, claim_status, claimed_by")
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    return { success: false, error: "Participant slot not found" };
  }

  if (participant.user_id !== null) {
    return { success: false, error: "This slot is already claimed by a user" };
  }

  if (participant.claim_status === "pending") {
    return { success: false, error: "This slot already has a pending claim" };
  }

  // Check if user is already a participant in this match
  const { data: existingParticipation } = await supabase
    .from("match_participants")
    .select("id")
    .eq("match_id", participant.match_id)
    .eq("user_id", user.id)
    .single();

  if (existingParticipation) {
    return {
      success: false,
      error: "You are already a participant in this match",
    };
  }

  // Submit the claim
  const result = await claimPlaceholderSlot(supabase, participantId, user.id);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/matches/claim");

  return { success: true, data: null };
}

/**
 * Claim a placeholder slot with auto-approval.
 *
 * The claim is immediately approved without requiring owner confirmation.
 * Returns match/collection info for the post-claim modal.
 */
export async function claimSlotWithAutoApproval(participantId: string): Promise<
  Result<{
    matchId: string;
    matchCreatorId: string;
    matchCreatorUsername: string;
    isAlreadyFriend: boolean;
    hasPendingFriendRequest: boolean;
    collections: Array<{
      id: string;
      name: string;
      isMember: boolean;
      hasPendingRequest: boolean;
    }>;
  }>
> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify the slot is claimable and get match/creator info
  const { data: participant, error: fetchError } = await supabase
    .from("match_participants")
    .select(
      `
      id, 
      match_id, 
      user_id, 
      claim_status, 
      claimed_by,
      placeholder_name,
      match:matches!inner (
        id,
        format_id,
        created_by,
        ratings_applied_at,
        creator:profiles!matches_created_by_fkey (
          id,
          username
        )
      )
    `,
    )
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    return { success: false, error: "Participant slot not found" };
  }

  if (participant.user_id !== null) {
    return { success: false, error: "This slot is already claimed by a user" };
  }

  if (participant.claim_status === "approved") {
    return { success: false, error: "This slot has already been claimed" };
  }

  // Check if user is already a participant in this match
  const { data: existingParticipation } = await supabase
    .from("match_participants")
    .select("id")
    .eq("match_id", participant.match_id)
    .eq("user_id", user.id)
    .single();

  if (existingParticipation) {
    return {
      success: false,
      error: "You are already a participant in this match",
    };
  }

  const match = participant.match as {
    id: string;
    format_id: string;
    created_by: string;
    ratings_applied_at: string | null;
    creator: { id: string; username: string };
  };

  // Auto-approve: directly set user_id and claim_status to approved
  const { error: updateError } = await supabase
    .from("match_participants")
    .update({
      user_id: user.id,
      claimed_by: user.id,
      claim_status: "approved",
      placeholder_name: null, // Clear placeholder name
    })
    .eq("id", participantId)
    .is("user_id", null); // Safety check

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // If match already had ratings applied, immediately recalculate for all participants
  // This ensures the claiming user gets their rating and other participants get recalculated
  // with the new opponent included
  if (match.ratings_applied_at) {
    console.log(
      `[RATING] claimSlotWithAutoApproval: Match ${match.id} has ratings applied, starting recalculation for all participants`,
    );
    // Get all participants including the newly claimed user
    const { data: allParticipants } = await supabase
      .from("match_participants")
      .select(
        `
        id,
        user_id,
        is_winner,
        deck:decks!match_participants_deck_id_fkey(id, bracket)
      `,
      )
      .eq("match_id", match.id)
      .not("user_id", "is", null);

    if (allParticipants && allParticipants.length > 0) {
      // Get existing rating_history to find old deltas and wins
      const { data: oldHistory } = await supabase
        .from("rating_history")
        .select("user_id, delta, collection_id, format_id, is_win")
        .eq("match_id", match.id);

      // Build map of old rating changes per user/scope
      const oldChanges: Map<string, { delta: number; isWin: boolean }> =
        new Map();
      for (const h of oldHistory ?? []) {
        // Key: "userId|collectionId" (collection_id = null for global)
        const key = `${h.user_id}|${h.collection_id ?? "global"}`;
        oldChanges.set(key, { delta: h.delta, isWin: h.is_win });
      }

      // Delete existing rating_history for this match (will be recreated)
      // Use RPC function to bypass RLS (rating_history is system-managed)
      console.log(
        `[RATING] claimSlotWithAutoApproval: Deleting existing rating_history for match ${match.id}`,
      );
      const { data: deletedCount, error: deleteError } = await supabase.rpc(
        "delete_match_rating_history",
        { p_match_id: match.id },
      );
      if (deleteError) {
        console.error(
          `[RATING] claimSlotWithAutoApproval: FAILED to delete rating_history - ${deleteError.message}`,
        );
      } else {
        console.log(
          `[RATING] claimSlotWithAutoApproval: Deleted ${deletedCount} rating_history entries`,
        );
      }

      // Build participant base ratings (rating BEFORE this match was applied)
      // For users who had ratings applied: current_rating - old_delta
      // For new users (claiming user): current_rating (unchanged)
      const participantBaseRatings: Map<
        string,
        { rating: number; matchesPlayed: number }
      > = new Map();

      for (const p of allParticipants) {
        if (p.user_id) {
          const ratingResult = await getRating(
            supabase,
            p.user_id,
            match.format_id,
          );
          if (ratingResult.success) {
            const key = `${p.user_id}|global`;
            const oldChange = oldChanges.get(key);
            if (oldChange) {
              // Revert to rating before this match
              participantBaseRatings.set(p.user_id, {
                rating: ratingResult.data.rating - oldChange.delta,
                matchesPlayed: Math.max(0, ratingResult.data.matchesPlayed - 1),
              });
            } else {
              // New participant (claiming user) - no old delta to revert
              participantBaseRatings.set(p.user_id, ratingResult.data);
            }
          } else {
            participantBaseRatings.set(p.user_id, {
              rating: 1000,
              matchesPlayed: 0,
            });
          }
        }
      }

      // Calculate and apply ratings for each participant
      for (const p of allParticipants) {
        if (!p.user_id) continue;

        const baseRating = participantBaseRatings.get(p.user_id)!;
        const playerBracket: Bracket = (p.deck?.bracket as Bracket) ?? 2;

        // Build opponents array (excluding this participant)
        const opponents: Array<{ rating: number; bracket: Bracket }> = [];
        for (const opp of allParticipants) {
          if (opp.user_id && opp.user_id !== p.user_id) {
            const oppRating = participantBaseRatings.get(opp.user_id)!.rating;
            const bracket: Bracket = (opp.deck?.bracket as Bracket) ?? 2;
            opponents.push({ rating: oppRating, bracket });
          }
        }

        // Calculate rating change
        const ratingCalc = calculateRating({
          playerId: p.user_id,
          playerRating: baseRating.rating,
          playerBracket,
          playerMatchCount: baseRating.matchesPlayed,
          isWinner: p.is_winner,
          opponents,
          formatId: match.format_id,
          collectionId: null,
        });

        // Apply global rating change
        const newRating = baseRating.rating + ratingCalc.delta;
        console.log(
          `[RATING] claimSlotWithAutoApproval: Recalc for user ${p.user_id} - baseBefore: ${baseRating.rating}, delta: ${ratingCalc.delta}, after: ${newRating}, isWinner: ${p.is_winner}`,
        );
        await applyRatingChange(supabase, {
          userId: p.user_id,
          matchId: match.id,
          formatId: match.format_id,
          newRating,
          delta: ratingCalc.delta,
          isWin: p.is_winner,
          playerBracket,
          opponentAvgRating: ratingCalc.opponentAvgRating,
          opponentAvgBracket: ratingCalc.opponentAvgBracket,
          kFactor: ratingCalc.kFactor,
          algorithmVersion: 1,
        });

        // Update collection-scoped ratings (inline to handle reversion properly)
        const matchCollectionsResult = await getMatchCollections(
          supabase,
          match.id,
        );
        if (
          matchCollectionsResult.success &&
          matchCollectionsResult.data.length > 0
        ) {
          const userMemberCollectionsResult = await getUserMemberCollections(
            supabase,
            p.user_id,
            matchCollectionsResult.data,
          );

          if (
            userMemberCollectionsResult.success &&
            userMemberCollectionsResult.data.length > 0
          ) {
            for (const collectionId of userMemberCollectionsResult.data) {
              // Get current collection-scoped rating
              const collRatingResult = await getRating(
                supabase,
                p.user_id,
                match.format_id,
                collectionId,
              );
              if (!collRatingResult.success) continue;

              // Revert old delta if exists
              const collKey = `${p.user_id}|${collectionId}`;
              const oldCollChange = oldChanges.get(collKey);
              const collBaseRating = oldCollChange
                ? collRatingResult.data.rating - oldCollChange.delta
                : collRatingResult.data.rating;
              const collMatchCount = oldCollChange
                ? Math.max(0, collRatingResult.data.matchesPlayed - 1)
                : collRatingResult.data.matchesPlayed;

              // Calculate new rating change
              const collRatingCalc = calculateRating({
                playerId: p.user_id,
                playerRating: collBaseRating,
                playerBracket,
                playerMatchCount: collMatchCount,
                isWinner: p.is_winner,
                opponents, // Same opponents as global
                formatId: match.format_id,
                collectionId,
              });

              // Apply collection-scoped rating change
              const newCollRating = collBaseRating + collRatingCalc.delta;
              console.log(
                `[RATING] claimSlotWithAutoApproval: Collection ${collectionId} - user=${p.user_id}, baseBefore=${collBaseRating}, delta=${collRatingCalc.delta}, after=${newCollRating}`,
              );
              await applyRatingChange(supabase, {
                userId: p.user_id,
                matchId: match.id,
                formatId: match.format_id,
                collectionId,
                newRating: newCollRating,
                delta: collRatingCalc.delta,
                isWin: p.is_winner,
                playerBracket,
                opponentAvgRating: collRatingCalc.opponentAvgRating,
                opponentAvgBracket: collRatingCalc.opponentAvgBracket,
                kFactor: collRatingCalc.kFactor,
                algorithmVersion: 1,
              });
            }
          }
        }
      }

      // Clear dirty flag since we just recalculated
      console.log(
        `[RATING] claimSlotWithAutoApproval: Clearing is_dirty flag for match ${match.id} after recalculation`,
      );
      const { error: clearDirtyError } = await supabase
        .from("matches")
        .update({ is_dirty: false })
        .eq("id", match.id);
      
      if (clearDirtyError) {
        console.error(`[RATING] claimSlotWithAutoApproval: FAILED to clear is_dirty - ${clearDirtyError.message}`);
      } else {
        console.log(`[RATING] claimSlotWithAutoApproval: Successfully cleared is_dirty for match ${match.id}`);
      }
    }
  }

  // Check friendship status with match creator
  let isAlreadyFriend = false;
  let hasPendingFriendRequest = false;

  if (match.creator.id !== user.id) {
    const friendshipResult = await getFriendshipStatus(
      supabase,
      user.id,
      match.creator.id,
    );
    if (friendshipResult.success && friendshipResult.data) {
      isAlreadyFriend = friendshipResult.data.status === "accepted";
      hasPendingFriendRequest = friendshipResult.data.status === "pending";
    }
  } else {
    // User is the match creator, so mark as already friend (self)
    isAlreadyFriend = true;
  }

  // Get collections this match belongs to
  const { data: collectionLinks } = await supabase
    .from("collection_matches")
    .select(
      `
      collection:collections!collection_matches_collection_id_fkey (
        id,
        name
      )
    `,
    )
    .eq("match_id", participant.match_id)
    .eq("approval_status", "approved");

  // Build collections array with membership status
  const collectionsWithStatus: Array<{
    id: string;
    name: string;
    isMember: boolean;
    hasPendingRequest: boolean;
  }> = [];

  for (const link of collectionLinks ?? []) {
    if (!link.collection) continue;
    const coll = link.collection as { id: string; name: string };

    // Check if already a member
    const memberResult = await isCollectionMember(supabase, coll.id, user.id);
    const isMember = memberResult.success && memberResult.data;

    // Check for pending join request (notification-based)
    let hasPendingRequest = false;
    if (!isMember) {
      const { data: existingRequest } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "collection_join_request")
        .eq("entity_id", coll.id)
        .eq("triggered_by", user.id)
        .is("dismissed_at", null)
        .maybeSingle();

      hasPendingRequest = !!existingRequest;
    }

    collectionsWithStatus.push({
      id: coll.id,
      name: coll.name,
      isMember,
      hasPendingRequest,
    });
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/matches/claim");
  revalidatePath("/matches");

  return {
    success: true,
    data: {
      matchId: match.id,
      matchCreatorId: match.creator.id,
      matchCreatorUsername: match.creator.username,
      isAlreadyFriend,
      hasPendingFriendRequest,
      collections: collectionsWithStatus,
    },
  };
}

/**
 * Approve a claim request (match creator only)
 */
export async function approveClaimRequest(
  participantId: string,
): Promise<Result<null>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the participant and verify match creator
  const { data: participant, error: fetchError } = await supabase
    .from("match_participants")
    .select(
      `
      id,
      match_id,
      claim_status,
      claimed_by,
      match:matches!inner (
        created_by
      )
    `,
    )
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    return { success: false, error: "Participant slot not found" };
  }

  const match = participant.match as { created_by: string };
  if (match.created_by !== user.id) {
    return {
      success: false,
      error: "Only the match creator can approve claims",
    };
  }

  if (participant.claim_status !== "pending" || !participant.claimed_by) {
    return { success: false, error: "No pending claim to approve" };
  }

  // Approve the claim
  const result = await approveSlotClaim(supabase, participantId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");

  return { success: true, data: null };
}

/**
 * Reject a claim request (match creator only)
 */
export async function rejectClaimRequest(
  participantId: string,
): Promise<Result<null>> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the participant and verify match creator
  const { data: participant, error: fetchError } = await supabase
    .from("match_participants")
    .select(
      `
      id,
      match_id,
      claim_status,
      match:matches!inner (
        created_by
      )
    `,
    )
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    return { success: false, error: "Participant slot not found" };
  }

  const match = participant.match as { created_by: string };
  if (match.created_by !== user.id) {
    return {
      success: false,
      error: "Only the match creator can reject claims",
    };
  }

  if (participant.claim_status !== "pending") {
    return { success: false, error: "No pending claim to reject" };
  }

  // Reject the claim (resets to 'none' for re-claiming)
  const result = await rejectSlotClaim(supabase, participantId);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/notifications");

  return { success: true, data: null };
}

/**
 * Update a participant's deck.
 *
 * Deck updates are always allowed (even post-lock) because:
 * - Users may have forgotten to set their deck initially
 * - It corrects commander stats tracking
 *
 * If ratings have already been applied, this marks the match as dirty
 * for future recalculation.
 */
export async function updateMatchParticipantDeck(
  participantId: string,
  deckId: string,
): Promise<Result<null>> {
  console.log(`[RATING] updateMatchParticipantDeck: START participantId=${participantId}, newDeckId=${deckId}`);
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.log(`[RATING] updateMatchParticipantDeck: ABORT - not authenticated`);
    return { success: false, error: "Not authenticated" };
  }

  // Get the participant with match info AND current deck info
  const { data: participant, error: fetchError } = await supabase
    .from("match_participants")
    .select(
      `
      id, 
      match_id, 
      user_id, 
      confirmed_at,
      deck_id,
      current_deck:decks!match_participants_deck_id_fkey(id, bracket, deck_name, commander_name),
      match:matches!inner(ratings_applied_at, is_dirty)
    `,
    )
    .eq("id", participantId)
    .single();

  if (fetchError || !participant) {
    console.log(`[RATING] updateMatchParticipantDeck: ABORT - participant not found: ${fetchError?.message}`);
    return { success: false, error: "Participant slot not found" };
  }

  if (participant.user_id !== user.id) {
    return { success: false, error: "You can only update your own deck" };
  }

  // Get the old deck info for logging
  const oldDeck = participant.current_deck as { id: string; bracket: number; deck_name: string | null; commander_name: string } | null;
  const oldDeckDisplayName = oldDeck?.deck_name || oldDeck?.commander_name || 'Unknown';
  console.log(`[RATING] updateMatchParticipantDeck: Current deck: id=${oldDeck?.id ?? 'none'}, bracket=${oldDeck?.bracket ?? 'none'}, name="${oldDeckDisplayName}"`);

  // Verify the deck belongs to the user AND get its bracket
  const { data: newDeck, error: deckError } = await supabase
    .from("decks")
    .select("id, owner_id, bracket, deck_name, commander_name")
    .eq("id", deckId)
    .single();

  if (deckError || !newDeck) {
    console.log(`[RATING] updateMatchParticipantDeck: ABORT - new deck not found: ${deckError?.message}`);
    return { success: false, error: "Deck not found" };
  }

  if (newDeck.owner_id !== user.id) {
    return { success: false, error: "You can only use your own decks" };
  }

  const newDeckDisplayName = newDeck.deck_name || newDeck.commander_name || 'Unknown';
  console.log(`[RATING] updateMatchParticipantDeck: New deck: id=${newDeck.id}, bracket=${newDeck.bracket}, name="${newDeckDisplayName}"`);
  
  // Check if bracket is actually changing
  const bracketChanged = oldDeck?.bracket !== newDeck.bracket;
  console.log(`[RATING] updateMatchParticipantDeck: Bracket change: ${oldDeck?.bracket ?? 'none'} → ${newDeck.bracket} (changed=${bracketChanged})`);

  // Update the deck
  const result = await updateParticipantDeck(supabase, participantId, deckId);

  if (!result.success) {
    console.log(`[RATING] updateMatchParticipantDeck: ABORT - failed to update deck: ${result.error}`);
    return { success: false, error: result.error };
  }

  console.log(`[RATING] updateMatchParticipantDeck: deck_id updated in match_participants`);

  // If ratings have already been applied, mark match as dirty for recalculation
  const matchInfo = participant.match as { ratings_applied_at: string | null; is_dirty: boolean };
  console.log(`[RATING] updateMatchParticipantDeck: Match state: ratings_applied_at=${matchInfo.ratings_applied_at ?? 'null'}, is_dirty=${matchInfo.is_dirty}`);
  
  if (matchInfo.ratings_applied_at) {
    console.log(
      `[RATING] updateMatchParticipantDeck: Calling mark_match_dirty for match ${participant.match_id} (deck changed post-rating, bracket ${oldDeck?.bracket ?? 'none'} → ${newDeck.bracket})`,
    );
    // Use RPC function to bypass RLS (participants aren't the match creator)
    const { data: wasUpdated, error: dirtyError } = await supabase
      .rpc("mark_match_dirty", { p_match_id: participant.match_id });
    
    if (dirtyError) {
      console.error(`[RATING] updateMatchParticipantDeck: FAILED to set is_dirty - ${dirtyError.message}`);
    } else if (!wasUpdated) {
      console.warn(`[RATING] updateMatchParticipantDeck: mark_match_dirty returned false for match ${participant.match_id} (unexpected - ratings_applied_at exists)`);
    } else {
      console.log(`[RATING] updateMatchParticipantDeck: SUCCESS - match ${participant.match_id} marked dirty for recalculation`);
    }
  } else {
    console.log(`[RATING] updateMatchParticipantDeck: Skipping dirty marking - ratings not yet applied`);
  }

  // Revalidate pages
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/matches");

  console.log(`[RATING] updateMatchParticipantDeck: COMPLETE for match ${participant.match_id}`);
  return { success: true, data: null };
}

// ============================================
// Invite Token Actions
// ============================================

/**
 * Generate a token string (12 chars, URL-safe, no ambiguous characters)
 */
function generateToken(length: number = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Create an invite token for a match.
 * Only the match creator can generate invite tokens.
 */
export async function createMatchInviteToken(
  matchId: string
): Promise<Result<{ token: string; inviteUrl: string }>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is the match creator
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, created_by')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can generate invite links' }
  }

  // Check if there are any unclaimed placeholder slots
  const { data: placeholderSlots } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', matchId)
    .is('user_id', null)
    .eq('claim_status', 'none')

  if (!placeholderSlots || placeholderSlots.length === 0) {
    return { success: false, error: 'No unclaimed placeholder slots in this match' }
  }

  // Generate a unique token
  let token = generateToken()
  let attempts = 0
  const maxAttempts = 5

  // Check for collisions (extremely rare but possible)
  while (attempts < maxAttempts) {
    const { data: existing } = await supabase
      .from('match_invite_tokens')
      .select('id')
      .eq('token', token)
      .single()

    if (!existing) break
    token = generateToken()
    attempts++
  }

  if (attempts >= maxAttempts) {
    return { success: false, error: 'Failed to generate unique token. Please try again.' }
  }

  // Create the token record
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days expiry

  const { error: insertError } = await supabase
    .from('match_invite_tokens')
    .insert({
      match_id: matchId,
      token,
      created_by: user.id,
      expires_at: expiresAt.toISOString(),
    })

  if (insertError) {
    console.error('Failed to create invite token:', insertError)
    return { success: false, error: `Failed to create invite token: ${insertError.message}` }
  }

  return {
    success: true,
    data: {
      token,
      inviteUrl: `/claim/${token}`,
    },
  }
}

/**
 * Get match details by invite token.
 * Used to display the claim page when a guest clicks an invite link.
 */
export async function getMatchByInviteToken(
  token: string
): Promise<Result<{
  match: {
    id: string
    formatName: string
    formatSlug: string
    playedAt: string
    creatorUsername: string
    participantCount: number
  }
  placeholderSlots: Array<{
    participantId: string
    placeholderName: string
    claimStatus: ClaimStatus
    hasPendingClaim: boolean
  }>
  isExpired: boolean
  isUsed: boolean
}>> {
  const supabase = await createClient()

  // Get the token record
  const { data: tokenRecord, error: tokenError } = await supabase
    .from('match_invite_tokens')
    .select(`
      id,
      match_id,
      expires_at,
      used_at,
      used_by
    `)
    .eq('token', token)
    .single()

  if (tokenError || !tokenRecord) {
    return { success: false, error: 'Invalid invite token' }
  }

  const isExpired = new Date(tokenRecord.expires_at) < new Date()
  const isUsed = tokenRecord.used_at !== null

  // Get match details
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select(`
      id,
      played_at,
      format:formats!inner (
        name,
        slug
      ),
      creator:profiles!inner (
        username
      )
    `)
    .eq('id', tokenRecord.match_id)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  // Get placeholder slots
  const { data: participants } = await supabase
    .from('match_participants')
    .select(`
      id,
      placeholder_name,
      user_id,
      claim_status,
      claimed_by
    `)
    .eq('match_id', tokenRecord.match_id)

  // Get count of all participants
  const participantCount = participants?.length ?? 0

  // Filter to just placeholder slots
  const placeholderSlots = (participants ?? [])
    .filter(p => p.user_id === null)
    .map(p => ({
      participantId: p.id,
      placeholderName: p.placeholder_name ?? 'Unknown',
      claimStatus: p.claim_status as ClaimStatus,
      hasPendingClaim: p.claim_status === 'pending' && p.claimed_by !== null,
    }))

  return {
    success: true,
    data: {
      match: {
        id: match.id,
        formatName: (match.format as { name: string }).name,
        formatSlug: (match.format as { slug: string }).slug,
        playedAt: match.played_at,
        creatorUsername: (match.creator as { username: string }).username,
        participantCount,
      },
      placeholderSlots,
      isExpired,
      isUsed,
    },
  }
}

/**
 * Check if a match has any existing invite tokens.
 * Returns the most recent active token if one exists.
 */
export async function getExistingInviteToken(
  matchId: string
): Promise<Result<{ token: string; inviteUrl: string } | null>> {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify user is the match creator
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, created_by')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { success: false, error: 'Match not found' }
  }

  if (match.created_by !== user.id) {
    return { success: false, error: 'Only the match creator can view invite links' }
  }

  // Get the most recent non-expired token
  const { data: tokenRecord } = await supabase
    .from('match_invite_tokens')
    .select('token, expires_at')
    .eq('match_id', matchId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!tokenRecord) {
    return { success: true, data: null }
  }

  return {
    success: true,
    data: {
      token: tokenRecord.token,
      inviteUrl: `/claim/${tokenRecord.token}`,
    },
  }
}
