"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingDelta } from "@/components/ui";
import { UpdateDeckModal } from "@/components/match/update-deck-modal";
import { PostClaimModal } from "@/components/match/post-claim-modal";
import { claimSlotWithAutoApproval } from "@/app/actions/match";
import { PLACEHOLDER_DECK_NAME } from "@/types/deck";
import type { DeckSummary, RatingDelta as RatingDeltaType } from "@/types";

type ParticipantInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  userId: string | null;
  isWinner: boolean;
  isConfirmed: boolean;
  ratingDelta: RatingDeltaType | null;
  deck: {
    id: string;
    commanderName: string | null;
    deckName: string | null;
    bracket: number;
  } | null;
};

interface ParticipantListProps {
  participants: ParticipantInfo[];
  currentUserId: string | null;
  userDecks: DeckSummary[];
  matchCreatorId: string;
  matchCreatorUsername: string;
}

/**
 * Client component for match participant list with update deck and claim functionality.
 * Shows "Update Deck" button for user's own unconfirmed slots with placeholder decks.
 * Shows "Claim Slot" button for unclaimed placeholder slots.
 */
export function ParticipantList({
  participants,
  currentUserId,
  userDecks,
  matchCreatorId,
  matchCreatorUsername,
}: ParticipantListProps) {
  const router = useRouter();
  
  // Update deck modal state
  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = React.useState<string | null>(null);
  
  // Claim state
  const [claimingSlotId, setClaimingSlotId] = React.useState<string | null>(null);
  const [claimError, setClaimError] = React.useState<string | null>(null);
  
  // Post-claim modal state
  const [showPostClaimModal, setShowPostClaimModal] = React.useState(false);
  const [claimResult, setClaimResult] = React.useState<{
    matchCreatorId: string;
    matchCreatorUsername: string;
    collections: Array<{ id: string; name: string }>;
  } | null>(null);

  const handleOpenModal = (participantId: string, deckId: string | null) => {
    setSelectedParticipantId(participantId);
    setSelectedDeckId(deckId);
  };

  const handleCloseModal = () => {
    setSelectedParticipantId(null);
    setSelectedDeckId(null);
    router.refresh();
  };

  const handleClaimSlot = async (participantId: string) => {
    setClaimingSlotId(participantId);
    setClaimError(null);

    const result = await claimSlotWithAutoApproval(participantId);

    if (!result.success) {
      setClaimError(result.error);
      setClaimingSlotId(null);
      return;
    }

    // Show post-claim modal
    setClaimResult({
      matchCreatorId: result.data.matchCreatorId,
      matchCreatorUsername: result.data.matchCreatorUsername,
      collections: result.data.collections,
    });
    setShowPostClaimModal(true);
    setClaimingSlotId(null);
    router.refresh();
  };

  const handleClosePostClaimModal = () => {
    setShowPostClaimModal(false);
    setClaimResult(null);
  };

  // Check if current user is already a participant
  const isAlreadyParticipant = currentUserId && participants.some(p => p.userId === currentUserId);

  return (
    <>
      {/* Claim error message */}
      {claimError && (
        <div className="mb-4 rounded-md bg-danger-dim border border-danger-ring p-3 text-sm text-danger">
          {claimError}
        </div>
      )}

      <div className="space-y-3">
        {participants.map((participant, index) => {
          const isOwnSlot = currentUserId && participant.userId === currentUserId;
          const canUpdateDeck = isOwnSlot && !participant.isConfirmed;
          const hasPlaceholderDeck = participant.deck && 
            (participant.deck.deckName === PLACEHOLDER_DECK_NAME || 
             !participant.deck.deckName);
          
          // Can claim if: logged in, slot is unclaimed (userId is null), and user isn't already in the match
          const isUnclaimedSlot = participant.userId === null;
          const canClaim = currentUserId && isUnclaimedSlot && !isAlreadyParticipant;

          return (
            <div
              key={participant.id}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-3 border-b border-card-border last:border-0 ${
                isUnclaimedSlot ? "bg-accent-dim/20 -mx-4 px-4 rounded-lg" : ""
              }`}
            >
              {/* Profile info */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-3 w-6 shrink-0">#{index + 1}</span>
                <Avatar
                  src={participant.avatarUrl}
                  alt={participant.name}
                  fallback={participant.name}
                  size="lg"
                  className="h-10! w-10! sm:h-14! sm:w-14! shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-1 truncate">{participant.name}</p>
                    {isUnclaimedSlot && (
                      <Badge variant="outline" className="text-accent border-accent/30 text-xs">
                        Open Slot
                      </Badge>
                    )}
                  </div>
                  {participant.deck && (
                    <p className="text-sm text-text-3 truncate">
                      {participant.deck.commanderName || "Unknown Commander"}
                      {hasPlaceholderDeck && canUpdateDeck && (
                        <span className="text-accent ml-1">(placeholder)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Badges and actions - stacks below on mobile */}
              <div className="flex items-center gap-2 pl-9 sm:pl-0 flex-wrap">
                {/* Rating delta for confirmed participants or preview for pending */}
                {participant.ratingDelta && (
                  <RatingDelta 
                    delta={participant.ratingDelta.delta} 
                    size="md"
                    isPreview={participant.ratingDelta.isPreview}
                  />
                )}

                {/* Claim button for unclaimed slots */}
                {canClaim && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleClaimSlot(participant.id)}
                    disabled={claimingSlotId === participant.id}
                  >
                    {claimingSlotId === participant.id ? "Claiming..." : "Claim This Slot"}
                  </Button>
                )}

                {/* Update deck button for user's own slot */}
                {canUpdateDeck && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenModal(
                      participant.id,
                      participant.deck?.id ?? null
                    )}
                  >
                    Update Deck
                  </Button>
                )}
                
                {participant.isWinner && (
                  <Badge variant="win">Winner</Badge>
                )}
                {!isUnclaimedSlot && (
                  participant.isConfirmed ? (
                    <Badge variant="outline" className="text-text-3">
                      Confirmed
                    </Badge>
                  ) : (
                    <Badge variant="default">Pending</Badge>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Update Deck Modal */}
      <UpdateDeckModal
        isOpen={selectedParticipantId !== null}
        onClose={handleCloseModal}
        participantId={selectedParticipantId ?? ""}
        currentDeckId={selectedDeckId}
        decks={userDecks}
      />

      {/* Post-Claim Modal */}
      {claimResult && currentUserId && (
        <PostClaimModal
          isOpen={showPostClaimModal}
          onClose={handleClosePostClaimModal}
          matchCreatorId={claimResult.matchCreatorId}
          matchCreatorUsername={claimResult.matchCreatorUsername}
          collections={claimResult.collections}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
