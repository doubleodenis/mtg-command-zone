"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingDelta } from "@/components/ui";
import { UpdateDeckModal } from "@/components/match/update-deck-modal";
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
}

/**
 * Client component for match participant list with update deck functionality.
 * Shows "Update Deck" button for user's own unconfirmed slots with placeholder decks.
 */
export function ParticipantList({
  participants,
  currentUserId,
  userDecks,
}: ParticipantListProps) {
  const router = useRouter();
  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = React.useState<string | null>(null);

  const handleOpenModal = (participantId: string, deckId: string | null) => {
    setSelectedParticipantId(participantId);
    setSelectedDeckId(deckId);
  };

  const handleCloseModal = () => {
    setSelectedParticipantId(null);
    setSelectedDeckId(null);
    router.refresh();
  };

  return (
    <>
      <div className="space-y-3">
        {participants.map((participant, index) => {
          const isOwnSlot = currentUserId && participant.userId === currentUserId;
          const canUpdateDeck = isOwnSlot && !participant.isConfirmed;
          const hasPlaceholderDeck = participant.deck && 
            (participant.deck.deckName === PLACEHOLDER_DECK_NAME || 
             !participant.deck.deckName);

          return (
            <div
              key={participant.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-3 border-b border-card-border last:border-0"
            >
              {/* Profile info */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-3 w-6 shrink-0">#{index + 1}</span>
                <Avatar
                  src={participant.avatarUrl}
                  alt={participant.name}
                  fallback={participant.name}
                  size="lg"
                  className="!h-10 !w-10 sm:!h-14 sm:!w-14 shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium text-text-1 truncate">{participant.name}</p>
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
                {/* Rating delta for confirmed participants */}
                {participant.ratingDelta && (
                  <RatingDelta delta={participant.ratingDelta.delta} size="md" />
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
                {participant.isConfirmed ? (
                  <Badge variant="outline" className="text-text-3">
                    Confirmed
                  </Badge>
                ) : (
                  <Badge variant="default">Pending</Badge>
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
    </>
  );
}
