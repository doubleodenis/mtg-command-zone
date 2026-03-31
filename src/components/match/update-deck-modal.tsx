"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ColorIdentity } from "@/components/ui/mana-pip";
import { BracketIndicator } from "@/components/ui/bracket-indicator";
import { updateMatchParticipantDeck } from "@/app/actions/match";
import type { DeckSummary } from "@/types";
import type { ManaColor } from "@/app/_design-system";

interface UpdateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantId: string;
  currentDeckId: string | null;
  decks: DeckSummary[];
}

/**
 * Modal for updating a participant's deck retroactively.
 * Shows the user's decks and allows selection.
 */
export function UpdateDeckModal({
  isOpen,
  onClose,
  participantId,
  currentDeckId,
  decks,
}: UpdateDeckModalProps) {
  const [selectedDeckId, setSelectedDeckId] = React.useState<string | null>(currentDeckId);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedDeckId(currentDeckId);
      setError(null);
    }
  }, [isOpen, currentDeckId]);

  const handleSubmit = async () => {
    if (!selectedDeckId) {
      setError("Please select a deck");
      return;
    }

    if (selectedDeckId === currentDeckId) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await updateMatchParticipantDeck(participantId, selectedDeckId);

    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-bg-overlay/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-md mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="shrink-0">
          <h2 className="font-display text-lg font-semibold text-text-1">
            Update Deck
          </h2>
          <p className="text-sm text-text-2">
            Select the deck you used in this match
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto py-0">
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md bg-danger-dim border border-danger-ring p-3 text-sm text-danger">
              {error}
            </div>
          )}

          {/* Deck list */}
          {decks.length > 0 ? (
            <div className="space-y-2 pb-4">
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => setSelectedDeckId(deck.id)}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-colors",
                    selectedDeckId === deck.id
                      ? "border-accent bg-accent-dim/50"
                      : "border-card-border hover:border-accent/50 hover:bg-surface/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-1 truncate">
                        {deck.deckName || deck.commanderName}
                      </p>
                      {deck.deckName && (
                        <p className="text-xs text-text-2 truncate mt-0.5">
                          {deck.commanderName}
                          {deck.partnerName && ` & ${deck.partnerName}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ColorIdentity 
                        colors={deck.colorIdentity as ManaColor[]} 
                        size="sm" 
                      />
                      <BracketIndicator bracket={deck.bracket} size="sm" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-text-2">No decks available</p>
              <p className="text-sm text-text-3 mt-1">
                Create a deck first to update this slot
              </p>
            </div>
          )}
        </CardContent>

        {/* Actions */}
        <div className="shrink-0 flex items-center justify-end gap-2 p-4 border-t border-card-border">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !selectedDeckId || decks.length === 0}
          >
            {isSubmitting ? "Updating..." : "Update Deck"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
