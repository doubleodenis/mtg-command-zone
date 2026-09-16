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
  applyParticipantRating,
} from "@/lib/supabase/ratings";
import {
  addMatchToCollection,
  getCollectionById,
  isCollectionMember,
} from "@/lib/supabase/collections";
import { getFriendshipStatus } from "@/lib/supabase/profiles";
import { shouldAutoConfirmParticipant } from "@/lib/confirmation";
import type {
  Result,
  ClaimableMatchSlot,
  ClaimStatus,
  CreateMatchPayload,
  MatchData,
  ParticipantInput,
  ApprovalStatus,
  ParticipantStatus,
  FriendshipStatus,
} from "@/types";

/**
 * Log a new match with participants.
 *
 * This action:
 * 1. Creates the match and participant records
 * 2. Adds the match to any selected collections
 * 3. Auto-confirms and rates the reporter, plus any other real participant
 *    who is already an accepted friend of the reporter (see
 *    shouldAutoConfirmParticipant / REQUIREMENTS.md §3.2). Everyone else
 *    stays pending -- they confirm themselves later (confirmMatch), or the
 *    match resolves automatically when they become friends with the
 *    reporter (see acceptFriendRequest's pending-match sweep).
 * 4. Returns the reporter's actual rating delta.
 *
 * Winner cannot be changed after match creation.
 * Deck updates are allowed but will trigger dirty-match recalculation if
 * a rating was already applied.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const matchResult = await createMatch(
    supabase,
    user.id,
    payload as CreateMatchPayload,
  );
  if (!matchResult.success) {
    return { success: false, error: matchResult.error };
  }

  const match = matchResult.data;

  // Add match to selected collections BEFORE applying ratings, so
  // applyParticipantRating (which reads getMatchCollections) sees them.
  if (payload.collectionIds && payload.collectionIds.length > 0) {
    for (const collectionId of payload.collectionIds) {
      const memberCheck = await isCollectionMember(
        supabase,
        collectionId,
        user.id,
      );
      if (!memberCheck.success || !memberCheck.data) {
        continue;
      }

      const collectionResult = await getCollectionById(supabase, collectionId);
      if (!collectionResult.success) {
        continue;
      }

      const collection = collectionResult.data;
      const isOwner = collection.ownerId === user.id;
      const permission = collection.matchAddPermission;

      if (permission === "owner_only" && !isOwner) {
        continue;
      }

      let approvalStatus: ApprovalStatus = "approved";
      if (!isOwner && permission === "any_member_approval_required") {
        approvalStatus = "pending";
      }

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

  // Get all real participants (not placeholders)
  const { data: participants, error: participantsError } = await supabase
    .from("match_participants")
    .select("id, user_id")
    .eq("match_id", match.id)
    .not("user_id", "is", null);

  if (participantsError) {
    return {
      success: false,
      error: `Failed to fetch participants: ${participantsError.message}`,
    };
  }

  const now = new Date().toISOString();
  let creatorDelta = 0;

  for (const participant of participants ?? []) {
    if (!participant.user_id) continue;

    const isReporter = participant.user_id === user.id;
    let friendshipStatus: FriendshipStatus | null = null;

    if (!isReporter) {
      const friendshipResult = await getFriendshipStatus(
        supabase,
        user.id,
        participant.user_id,
      );
      friendshipStatus =
        friendshipResult.success && friendshipResult.data
          ? friendshipResult.data.status
          : null;
    }

    const shouldConfirm = shouldAutoConfirmParticipant({
      reporterId: user.id,
      participantUserId: participant.user_id,
      friendshipStatus,
    });

    if (!shouldConfirm) continue; // stays 'pending' -- notification already fires via DB trigger

    const { data: confirmedRows } = await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: now,
      })
      .eq("id", participant.id)
      .select("id");

    if (!confirmedRows || confirmedRows.length === 0) {
      console.error(
        `[RATING] logMatch: FAILED to confirm participant ${participant.id} - update matched 0 rows`,
      );
    }

    const applyResult = await applyParticipantRating(supabase, participant.id);
    if (applyResult.success) {
      if (isReporter) {
        creatorDelta = applyResult.data.delta;
      }
    } else {
      console.error(
        `[RATING] logMatch: FAILED to apply rating for participant ${participant.id} - ${applyResult.error}`,
      );
    }

    if (!isReporter) {
      // The AFTER INSERT trigger on match_participants already created a
      // match_pending_confirmation notification for this participant when
      // the row was inserted (it can't know we're about to auto-confirm
      // them milliseconds later because they're an accepted friend). Clear
      // it now so they don't see a stale "needs your confirmation"
      // notification for a match that's already fully confirmed and rated
      // on their behalf.
      await supabase
        .from("notifications")
        .delete()
        .eq("recipient_id", participant.user_id)
        .eq("type", "match_pending_confirmation")
        .eq("entity_type", "match")
        .eq("entity_id", match.id);
    }
  }

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
 * Confirm a participant's own match participation, applying their rating.
 *
 * Safe to call even if the participant was already auto-confirmed and
 * rated elsewhere (e.g. logMatch's friend auto-confirm, or a claim
 * approval) -- applyParticipantRating is idempotent.
 */
export async function confirmMatch(
  participantId: string,
  deckId?: string,
): Promise<Result<{ delta: number }>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { data: participant, error: participantError } = await supabase
    .from("match_participants")
    .select("id, user_id, match_id, participant_status, deck_id")
    .eq("id", participantId)
    .single();

  if (participantError || !participant) {
    return { success: false, error: "Participant not found" };
  }

  if (participant.user_id !== user.id) {
    return {
      success: false,
      error: "You can only update your own participation",
    };
  }

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

  if (participant.participant_status === "pending") {
    const { data: confirmedRows } = await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId)
      .select("id");

    if (!confirmedRows || confirmedRows.length === 0) {
      console.error(
        `[RATING] confirmMatch: FAILED to confirm participant ${participantId} - update matched 0 rows`,
      );
    }
  }

  const applyResult = await applyParticipantRating(supabase, participantId);

  revalidatePath("/dashboard");
  revalidatePath("/matches");
  revalidatePath(`/match/${participant.match_id}`);
  revalidatePath("/notifications");

  if (!applyResult.success) {
    console.error(
      `[RATING] confirmMatch: FAILED to apply rating for participant ${participantId} - ${applyResult.error}`,
    );
    return { success: false, error: applyResult.error };
  }

  return {
    success: true,
    data: { delta: applyResult.data.delta },
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
    creator: { id: string; username: string };
  };

  const { error: updateError } = await supabase
    .from("match_participants")
    .update({
      user_id: user.id,
      claimed_by: user.id,
      claim_status: "approved",
      placeholder_name: null,
    })
    .eq("id", participantId)
    .is("user_id", null);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Check friendship status with match creator -- decides both whether to
  // auto-confirm+rate below, and what the post-claim UI shows.
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
    isAlreadyFriend = true;
  }

  const shouldConfirm = shouldAutoConfirmParticipant({
    reporterId: match.created_by,
    participantUserId: user.id,
    friendshipStatus: isAlreadyFriend ? "accepted" : null,
  });

  if (shouldConfirm) {
    const { data: confirmedRows } = await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId)
      .select("id");

    if (!confirmedRows || confirmedRows.length === 0) {
      console.error(
        `[RATING] claimSlotWithAutoApproval: FAILED to confirm participant ${participantId} - update matched 0 rows`,
      );
    }

    const applyResult = await applyParticipantRating(supabase, participantId);
    if (!applyResult.success) {
      console.error(
        `[RATING] claimSlotWithAutoApproval: FAILED to apply rating for participant ${participantId} - ${applyResult.error}`,
      );
    }
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

  const friendshipResult = await getFriendshipStatus(
    supabase,
    participant.claimed_by!,
    match.created_by,
  );
  const friendshipStatus =
    friendshipResult.success && friendshipResult.data
      ? friendshipResult.data.status
      : null;

  const shouldConfirm = shouldAutoConfirmParticipant({
    reporterId: match.created_by,
    participantUserId: participant.claimed_by!,
    friendshipStatus,
  });

  if (shouldConfirm) {
    const { data: confirmedRows } = await supabase
      .from("match_participants")
      .update({
        participant_status: "confirmed" as ParticipantStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", participantId)
      .select("id");

    if (!confirmedRows || confirmedRows.length === 0) {
      console.error(
        `[RATING] approveClaimRequest: FAILED to confirm participant ${participantId} - update matched 0 rows`,
      );
    }

    const applyResult = await applyParticipantRating(supabase, participantId);
    if (!applyResult.success) {
      console.error(
        `[RATING] approveClaimRequest: FAILED to apply rating for participant ${participantId} - ${applyResult.error}`,
      );
    }
  }
  // else: stays pending -- the claimant confirms themselves via confirmMatch()

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
