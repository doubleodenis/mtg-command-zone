"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { logMatch } from "@/app/actions/match";
import type { FormatSummary, FormatSlug, MatchData } from "@/types/format";
import type { DeckSummary, ParticipantInput, ColorIdentity } from "@/types";

import { FormatSelector } from "./format-selector";
import { PlayerSlot } from "./player-slot";
import { PentagramLayout } from "./pentagram-layout";
import type { ParticipantSlot, SearchResult } from "./match-form-types";
import Link from "next/link";

// ============================================
// Main Component
// ============================================

interface MatchFormProps {
  formats: FormatSummary[];
  currentUserId: string;
  currentUserDecks: DeckSummary[];
  currentUser?: SearchResult;
  className?: string;
}

export function MatchForm({
  formats,
  currentUserId,
  currentUserDecks,
  currentUser,
  className,
}: MatchFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [selectedFormat, setSelectedFormat] =
    React.useState<FormatSummary | null>(null);
  const [participants, setParticipants] = React.useState<ParticipantSlot[]>([]);
  const [playedAt, setPlayedAt] = React.useState(
    new Date().toISOString().slice(0, 16)
  );
  const [notes, setNotes] = React.useState("");

  // Deck cache for other users
  const [userDecks, setUserDecks] = React.useState<
    Record<string, DeckSummary[]>
  >({ [currentUserId]: currentUserDecks });

  // Initialize participants when format changes
  React.useEffect(() => {
    if (selectedFormat) {
      const minPlayers = selectedFormat.minPlayers;
      const slots: ParticipantSlot[] = Array(minPlayers).fill({
        type: "empty",
        isWinner: false,
      });
      setParticipants(slots);
    } else {
      setParticipants([]);
    }
  }, [selectedFormat]);

  // Fetch decks for a user
  const fetchDecksForUser = React.useCallback(async (userId: string) => {
    if (userDecks[userId]) return;

    const supabase = createClient();
    const { data } = await supabase
      .from("decks")
      .select("id, deck_name, commander_name, partner_name, color_identity, bracket, is_active")
      .eq("owner_id", userId)
      .eq("is_active", true);

    if (data) {
      setUserDecks((prev) => ({
        ...prev,
        [userId]: data.map((d) => ({
          id: d.id,
          deckName: d.deck_name,
          commanderName: d.commander_name,
          partnerName: d.partner_name,
          colorIdentity: d.color_identity as ColorIdentity,
          bracket: d.bracket as 1 | 2 | 3 | 4,
        })),
      }));
    }
  }, [userDecks]);

  // Add a registered player at a specific index
  const addRegisteredPlayerAt = React.useCallback(
    async (index: number, player: SearchResult) => {
      // Fetch decks for this user
      await fetchDecksForUser(player.id);

      const newParticipants = [...participants];
      newParticipants[index] = {
        type: "registered",
        userId: player.id,
        username: player.username,
        displayName: player.displayName || undefined,
        avatarUrl: player.avatarUrl || undefined,
        isWinner: false,
        team: getTeamForIndex(index),
      };
      setParticipants(newParticipants);
    },
    [participants, fetchDecksForUser]
  );

  // Set a slot as guest at a specific index
  const setAsGuestAt = React.useCallback(
    (index: number) => {
      const newParticipants = [...participants];
      newParticipants[index] = {
        type: "placeholder",
        placeholderName: "",
        isWinner: false,
        team: getTeamForIndex(index),
      };
      setParticipants(newParticipants);
    },
    [participants]
  );

  // Get team assignment based on index and format
  const getTeamForIndex = (index: number): string | undefined => {
    if (!selectedFormat?.hasTeams) return undefined;

    const slug = selectedFormat.slug as FormatSlug;
    if (slug === "1v1") {
      return index === 0 ? "A" : "B";
    }
    if (slug === "2v2") {
      return index < 2 ? "A" : "B";
    }
    if (slug === "3v3") {
      return index < 3 ? "A" : "B";
    }
    return undefined;
  };

  // Remove a participant
  const removeParticipant = (index: number) => {
    const newParticipants = [...participants];
    newParticipants[index] = { type: "empty", isWinner: false };
    setParticipants(newParticipants);
  };

  // Toggle winner status (for team formats, toggle all team members at once)
  const toggleWinner = (index: number) => {
    const participant = participants[index];
    const team = participant.team || getTeamForIndex(index);
    
    // For team formats, toggle all members of the same team
    if (selectedFormat?.hasTeams && selectedFormat.slug !== 'pentagram' && team) {
      toggleTeamWinner(team);
    } else {
      // For non-team formats (FFA, pentagram), toggle individual
      const newParticipants = [...participants];
      newParticipants[index] = {
        ...newParticipants[index],
        isWinner: !newParticipants[index].isWinner,
      };
      setParticipants(newParticipants);
    }
  };

  // Toggle winner status for an entire team
  const toggleTeamWinner = (team: string) => {
    const newParticipants = [...participants];
    // Check if any team member is currently a winner
    const teamIsCurrentlyWinner = newParticipants.some(
      (p, i) => getTeamForIndex(i) === team && p.isWinner
    );
    // Toggle all team members to the opposite state
    newParticipants.forEach((p, i) => {
      if (getTeamForIndex(i) === team) {
        newParticipants[i] = { ...p, isWinner: !teamIsCurrentlyWinner };
      }
    });
    setParticipants(newParticipants);
  };

  // Check if a team has any winner
  const isTeamWinner = (team: string): boolean => {
    return participants.some((p, i) => getTeamForIndex(i) === team && p.isWinner);
  };

  // Select deck for participant
  const selectDeck = (index: number, deckId: string) => {
    const newParticipants = [...participants];
    const deck = Object.values(userDecks)
      .flat()
      .find((d) => d.id === deckId);
    newParticipants[index] = {
      ...newParticipants[index],
      deckId: deckId || undefined,
      deckName: deck?.deckName ?? undefined,
    };
    setParticipants(newParticipants);
  };

  // Update placeholder name
  const updatePlaceholderName = (index: number, name: string) => {
    const newParticipants = [...participants];
    newParticipants[index] = {
      ...newParticipants[index],
      placeholderName: name,
    };
    setParticipants(newParticipants);
  };

  // Update commander name for placeholder players
  const updateCommanderName = (index: number, name: string) => {
    const newParticipants = [...participants];
    newParticipants[index] = {
      ...newParticipants[index],
      commanderName: name || undefined,
    };
    setParticipants(newParticipants);
  };

  // Add empty slot (for FFA with more players)
  const addSlot = () => {
    if (!selectedFormat) return;
    if (selectedFormat.maxPlayers && participants.length >= selectedFormat.maxPlayers) {
      return;
    }
    setParticipants([...participants, { type: "empty", isWinner: false }]);
  };

  // Remove empty slot (for FFA)
  const removeEmptySlot = () => {
    if (!selectedFormat) return;
    if (participants.length <= selectedFormat.minPlayers) return;

    // Remove last empty slot
    const lastEmptyIndex = participants.map((p) => p.type).lastIndexOf("empty");
    if (lastEmptyIndex !== -1) {
      const newParticipants = [...participants];
      newParticipants.splice(lastEmptyIndex, 1);
      setParticipants(newParticipants);
    }
  };

  // Build match data based on format
  const buildMatchData = (): MatchData => {
    const slug = selectedFormat?.slug as FormatSlug;

    if (slug === "ffa" || slug === "1v1") {
      return { format: slug };
    }

    if (slug === "2v2" || slug === "3v3") {
      return {
        format: slug,
        teams: {
          A: { name: "Team A" },
          B: { name: "Team B" },
        },
      };
    }

    if (slug === "pentagram") {
      // For pentagram, seating order is the order of participants
      const seatingOrder = participants
        .filter((p) => p.type !== "empty")
        .map((p) => p.userId || `placeholder-${p.placeholderName}`);

      return {
        format: "pentagram",
        seatingOrder: seatingOrder as [string, string, string, string, string],
      };
    }

    return { format: "ffa" };
  };

  // Validate form
  const validateForm = (): string | null => {
    if (!selectedFormat) {
      return "Please select a format";
    }

    const filledParticipants = participants.filter((p) => p.type !== "empty");

    if (filledParticipants.length < selectedFormat.minPlayers) {
      return `${selectedFormat.name} requires at least ${selectedFormat.minPlayers} players`;
    }

    // Check for placeholders without names
    const emptyPlaceholders = participants.filter(
      (p) => p.type === "placeholder" && !p.placeholderName?.trim()
    );
    if (emptyPlaceholders.length > 0) {
      return "Please enter names for all guest players";
    }

    // Check for at least one winner
    const winners = participants.filter((p) => p.isWinner);
    if (winners.length === 0) {
      return "Please select at least one winner";
    }

    // Check that current user (if participating) has selected a deck
    const currentUserParticipant = participants.find(
      (p) => p.type === "registered" && p.userId === currentUserId
    );
    if (currentUserParticipant && !currentUserParticipant.deckId) {
      return "Please select a deck for yourself";
    }

    // For team formats, validate winner consistency
    if (selectedFormat.hasTeams && selectedFormat.slug !== "pentagram") {
      const winnerTeams = new Set(winners.map((p) => p.team));
      if (winnerTeams.size > 1) {
        return "All winners must be on the same team";
      }
    }

    return null;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Build participant inputs
      const participantInputs: ParticipantInput[] = participants
        .filter((p) => p.type !== "empty")
        .map((p) => {
          if (p.type === "registered") {
            return {
              type: "registered" as const,
              userId: p.userId!,
              deckId: p.deckId || null,
              team: p.team || null,
            };
          } else {
            return {
              type: "placeholder" as const,
              placeholderName: p.placeholderName!,
              team: p.team || null,
            };
          }
        });

      // Find winner indices
      const winnerIndices = participants
        .map((p, i) => (p.isWinner && p.type !== "empty" ? i : -1))
        .filter((i) => i !== -1);

      // Adjust winner indices for filtered participants
      const filledIndices = participants
        .map((p, i) => (p.type !== "empty" ? i : -1))
        .filter((i) => i !== -1);
      const adjustedWinnerIndices = winnerIndices.map((wi) =>
        filledIndices.indexOf(wi)
      );

      // Create match via server action (handles rating calculation for creator)
      const result = await logMatch({
        formatId: selectedFormat!.id,
        playedAt: new Date(playedAt).toISOString(),
        notes: notes || null,
        matchData: buildMatchData(),
        participants: participantInputs,
        winnerIndices: adjustedWinnerIndices,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Navigate to the new match
      router.push(`/match/${result.data.matchId}`);
    } catch (err) {
      console.error("Failed to create match:", err);
      setError(err instanceof Error ? err.message : "Failed to create match");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get IDs to exclude from search
  const excludeIds = participants
    .filter((p) => p.type === "registered" && p.userId)
    .map((p) => p.userId!);

  // Is FFA format with flexible player count?
  const isFlexibleFormat =
    selectedFormat?.slug === "ffa" && !selectedFormat.maxPlayers;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {/* Warning if current user has no decks */}
      {currentUserDecks.length === 0 && (
        <div className="p-4 rounded-lg bg-gold/10 border border-gold/50">
          <p className="text-sm text-gold font-medium mb-1">
            You don't have any decks yet
          </p>
          <p className="text-xs text-text-2 mb-2">
            Create a deck before logging a match so you can track your commander stats.
          </p>
          <Link
            href="/decks/new"
            className="text-xs text-accent hover:underline"
          >
            Create your first deck →
          </Link>
        </div>
      )}

      {/* Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Game Format</CardTitle>
        </CardHeader>
        <CardContent>
          <FormatSelector
            formats={formats}
            selectedFormat={selectedFormat}
            onSelect={setSelectedFormat}
          />
        </CardContent>
      </Card>

      {/* Participants */}
      {selectedFormat && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Players</CardTitle>
              <div className="flex items-center gap-2">
                {selectedFormat && (
                  <Badge variant="outline">
                    {participants.filter((p) => p.type !== "empty").length} /{" "}
                    {selectedFormat.maxPlayers || `${selectedFormat.minPlayers}+`}
                  </Badge>
                )}
                {isFlexibleFormat && (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeEmptySlot}
                      disabled={participants.length <= selectedFormat.minPlayers}
                    >
                      −
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addSlot}
                    >
                      +
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Team-based layout for team formats */}
            {selectedFormat.hasTeams ? (
              <div className="flex flex-col md:grid md:grid-cols-[minmax(300px,1fr)_auto_minmax(300px,1fr)] gap-4">
                {/* Team A */}
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center gap-2 pb-2 border-b transition-colors",
                    isTeamWinner('A') ? "border-win/50" : "border-card-border"
                  )}>
                    <div className={cn(
                      "w-3 h-3 rounded-full transition-colors",
                      isTeamWinner('A') ? "bg-win" : "bg-accent"
                    )} />
                    <span className="text-sm font-semibold text-text-1">Team A</span>
                    <button
                      type="button"
                      onClick={() => toggleTeamWinner('A')}
                      className={cn(
                        "ml-auto p-1.5 rounded transition-colors text-xs flex items-center gap-1",
                        isTeamWinner('A')
                          ? "bg-win text-text-1"
                          : "bg-card-raised text-text-2 hover:text-text-1 hover:bg-accent/10"
                      )}
                      title={isTeamWinner('A') ? "Remove team win" : "Mark team as winner"}
                    >
                      <span>🏆</span>
                      <span className="text-xs font-medium">{isTeamWinner('A') ? "Winner" : "Won"}</span>
                    </button>
                  </div>
                  {participants
                    .map((slot, index) => ({ slot, index }))
                    .filter(({ index }) => getTeamForIndex(index) === "A")
                    .map(({ slot, index }) => (
                      <PlayerSlot
                        key={index}
                        slot={slot}
                        index={index}
                        currentUserId={currentUserId}
                        onSelectPlayer={(player) => addRegisteredPlayerAt(index, player)}
                        onSetAsGuest={() => setAsGuestAt(index)}
                        onRemove={() => removeParticipant(index)}
                        onToggleWinner={() => toggleWinner(index)}
                        onSelectDeck={(deckId) => selectDeck(index, deckId)}
                        onChangePlaceholderName={(name) =>
                          updatePlaceholderName(index, name)
                        }
                        onChangeCommanderName={(name) =>
                          updateCommanderName(index, name)
                        }
                        availableDecks={
                          slot.type === "registered" && slot.userId
                            ? userDecks[slot.userId] || []
                            : []
                        }
                        isTeamFormat={true}
                        team="A"
                        excludeIds={excludeIds}
                        currentUser={currentUser}
                        hideWinnerButton={true}
                      />
                    ))}
                </div>

                {/* VS Divider - horizontal on mobile, vertical on desktop */}
                <div className="flex md:flex-col items-center justify-center py-2 md:py-0 md:px-2">
                  <div className="flex-1 h-px md:h-auto md:w-px bg-card-border" />
                  <div className="mx-3 md:mx-0 md:my-3 px-3 py-1.5 rounded-full bg-card-raised border border-card-border">
                    <span className="text-xs font-bold text-text-2">VS</span>
                  </div>
                  <div className="flex-1 h-px md:h-auto md:w-px bg-card-border" />
                </div>

                {/* Team B */}
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center gap-2 pb-2 border-b transition-colors",
                    isTeamWinner('B') ? "border-win/50" : "border-card-border"
                  )}>
                    <div className={cn(
                      "w-3 h-3 rounded-full transition-colors",
                      isTeamWinner('B') ? "bg-win" : "bg-loss"
                    )} />
                    <span className="text-sm font-semibold text-text-1">Team B</span>
                    <button
                      type="button"
                      onClick={() => toggleTeamWinner('B')}
                      className={cn(
                        "ml-auto p-1.5 rounded transition-colors text-xs flex items-center gap-1",
                        isTeamWinner('B')
                          ? "bg-win text-text-1"
                          : "bg-card-raised text-text-2 hover:text-text-1 hover:bg-accent/10"
                      )}
                      title={isTeamWinner('B') ? "Remove team win" : "Mark team as winner"}
                    >
                      <span>🏆</span>
                      <span className="text-xs font-medium">{isTeamWinner('B') ? "Winner" : "Won"}</span>
                    </button>
                  </div>
                  {participants
                    .map((slot, index) => ({ slot, index }))
                    .filter(({ index }) => getTeamForIndex(index) === "B")
                    .map(({ slot, index }) => (
                      <PlayerSlot
                        key={index}
                        slot={slot}
                        index={index}
                        currentUserId={currentUserId}
                        onSelectPlayer={(player) => addRegisteredPlayerAt(index, player)}
                        onSetAsGuest={() => setAsGuestAt(index)}
                        onRemove={() => removeParticipant(index)}
                        onToggleWinner={() => toggleWinner(index)}
                        onSelectDeck={(deckId) => selectDeck(index, deckId)}
                        onChangePlaceholderName={(name) =>
                          updatePlaceholderName(index, name)
                        }
                        onChangeCommanderName={(name) =>
                          updateCommanderName(index, name)
                        }
                        availableDecks={
                          slot.type === "registered" && slot.userId
                            ? userDecks[slot.userId] || []
                            : []
                        }
                        isTeamFormat={true}
                        team="B"
                        excludeIds={excludeIds}
                        currentUser={currentUser}
                        hideWinnerButton={true}
                      />
                    ))}
                </div>
              </div>
            ) : selectedFormat.slug === "pentagram" ? (
              /* Pentagram layout - pentagon with enemies shown */
              <PentagramLayout
                participants={participants}
                currentUserId={currentUserId}
                onSelectPlayer={(index, player) => addRegisteredPlayerAt(index, player)}
                onSetAsGuest={(index) => setAsGuestAt(index)}
                onRemove={(index) => removeParticipant(index)}
                onToggleWinner={(index) => toggleWinner(index)}
                onSelectDeck={(index, deckId) => selectDeck(index, deckId)}
                onChangePlaceholderName={(index, name) => updatePlaceholderName(index, name)}
                onChangeCommanderName={(index, name) => updateCommanderName(index, name)}
                userDecks={userDecks}
                excludeIds={excludeIds}
                currentUser={currentUser}
              />
            ) : (
              /* Non-team layout (FFA) */
              <div className="space-y-3">
                {participants.map((slot, index) => (
                  <PlayerSlot
                    key={index}
                    slot={slot}
                    index={index}
                    currentUserId={currentUserId}
                    onSelectPlayer={(player) => addRegisteredPlayerAt(index, player)}
                    onSetAsGuest={() => setAsGuestAt(index)}
                    onRemove={() => removeParticipant(index)}
                    onToggleWinner={() => toggleWinner(index)}
                    onSelectDeck={(deckId) => selectDeck(index, deckId)}
                    onChangePlaceholderName={(name) =>
                      updatePlaceholderName(index, name)
                    }
                    onChangeCommanderName={(name) =>
                      updateCommanderName(index, name)
                    }
                    availableDecks={
                      slot.type === "registered" && slot.userId
                        ? userDecks[slot.userId] || []
                        : []
                    }
                    isTeamFormat={false}
                    team={undefined}
                    excludeIds={excludeIds}
                    currentUser={currentUser}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Match Details */}
      {selectedFormat && (
        <Card>
          <CardHeader>
            <CardTitle>Match Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text-1 block mb-2">
                Date & Time
              </label>
              <Input
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-1 block mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this match..."
                className="w-full h-24 rounded-md px-4 py-2 bg-card border border-card-border text-text-1 placeholder:text-text-2 resize-none focus:outline-none focus:border-accent-ring focus:ring-1 focus:ring-accent-ring"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-loss/10 border border-loss/50 text-loss text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      {selectedFormat && (
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Match"}
          </Button>
        </div>
      )}
    </form>
  );
}
