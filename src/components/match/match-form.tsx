"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormatBadge } from "@/components/ui/format-badge";
import { createClient } from "@/lib/supabase/client";
import { searchCommanders, type ScryfallCard } from "@/lib/scryfall/api";
import type { FormatSummary, FormatSlug, MatchData } from "@/types/format";
import type { DeckSummary, ProfileSummary, ParticipantInput, ColorIdentity } from "@/types";

// ============================================
// Types
// ============================================

type ParticipantSlot = {
  type: "empty" | "registered" | "placeholder";
  userId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  deckId?: string;
  deckName?: string;
  placeholderName?: string;
  commanderName?: string; // For placeholder players
  team?: string;
  isWinner: boolean;
};

type SearchResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

// ============================================
// Sub-components
// ============================================

function FormatSelector({
  formats,
  selectedFormat,
  onSelect,
}: {
  formats: FormatSummary[];
  selectedFormat: FormatSummary | null;
  onSelect: (format: FormatSummary) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-text-1">Format</label>
      <div className="flex flex-wrap gap-2">
        {formats.map((format) => (
          <button
            key={format.id}
            type="button"
            onClick={() => onSelect(format)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all",
              selectedFormat?.id === format.id
                ? "bg-accent-fill text-text-1 shadow-[0_0_12px_rgba(136,24,200,0.3)]"
                : "bg-card border border-card-border text-text-2 hover:border-card-border-hi hover:text-text-1"
            )}
          >
            {format.name}
          </button>
        ))}
      </div>
      {selectedFormat && (
        <p className="text-xs text-text-2">
          {getFormatDescription(selectedFormat)}
        </p>
      )}
    </div>
  );
}

function getFormatDescription(format: FormatSummary): string {
  const playerText = format.maxPlayers
    ? format.minPlayers === format.maxPlayers
      ? `${format.minPlayers} players`
      : `${format.minPlayers}-${format.maxPlayers} players`
    : `${format.minPlayers}+ players`;

  const teamText = format.hasTeams ? " • Team-based" : "";
  return playerText + teamText;
}

function PlayerSlot({
  slot,
  index,
  onSelectPlayer,
  onSetAsGuest,
  onRemove,
  onToggleWinner,
  onSelectDeck,
  onChangePlaceholderName,
  onChangeCommanderName,
  availableDecks,
  isTeamFormat,
  team,
  excludeIds,
}: {
  slot: ParticipantSlot;
  index: number;
  onSelectPlayer: (player: SearchResult) => void;
  onSetAsGuest: () => void;
  onRemove: () => void;
  onToggleWinner: () => void;
  onSelectDeck: (deckId: string) => void;
  onChangePlaceholderName: (name: string) => void;
  onChangeCommanderName: (name: string) => void;
  availableDecks: DeckSummary[];
  isTeamFormat: boolean;
  team?: string;
  excludeIds: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Commander search state for placeholder players
  const [commanderQuery, setCommanderQuery] = React.useState("");
  const [commanderResults, setCommanderResults] = React.useState<ScryfallCard[]>([]);
  const [isCommanderLoading, setIsCommanderLoading] = React.useState(false);
  const [isCommanderOpen, setIsCommanderOpen] = React.useState(false);
  const commanderTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Commander search effect for placeholder slots
  React.useEffect(() => {
    if (slot.type !== "placeholder" || commanderQuery.length < 2) {
      setCommanderResults([]);
      return;
    }

    if (commanderTimeoutRef.current) clearTimeout(commanderTimeoutRef.current);
    commanderTimeoutRef.current = setTimeout(async () => {
      setIsCommanderLoading(true);
      try {
        const commanders = await searchCommanders(commanderQuery);
        setCommanderResults(commanders.slice(0, 6));
        setIsCommanderOpen(commanders.length > 0);
      } catch (error) {
        console.error("Commander search error:", error);
      } finally {
        setIsCommanderLoading(false);
      }
    }, 300);

    return () => {
      if (commanderTimeoutRef.current) clearTimeout(commanderTimeoutRef.current);
    };
  }, [commanderQuery, slot.type]);

  const handleCommanderSelect = (card: ScryfallCard) => {
    onChangeCommanderName(card.name);
    setCommanderQuery("");
    setCommanderResults([]);
    setIsCommanderOpen(false);
  };

  // Search effect for empty slots
  React.useEffect(() => {
    if (slot.type !== "empty" || query.length < 2) {
      setResults([]);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .ilike("username", `%${query}%`)
          .not("id", "in", `(${excludeIds.join(",")})`)
          .limit(5);

        if (data) {
          setResults(
            data.map((p) => ({
              id: p.id,
              username: p.username,
              displayName: null,
              avatarUrl: p.avatar_url,
            }))
          );
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query, excludeIds, slot.type]);

  const handleSelect = (player: SearchResult) => {
    onSelectPlayer(player);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  // Empty slot - show search with integrated guest option
  if (slot.type === "empty") {
    return (
      <div className="p-3 rounded-lg border border-dashed border-card-border bg-card-raised/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-text-2">
            Player {index + 1}
            {isTeamFormat && team && ` • Team ${team}`}
          </span>
        </div>
        <div className="relative">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder="Search players or add guest..."
            className="h-9 text-sm pr-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            </div>
          )}

          {/* Dropdown with search results and guest option */}
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card border border-card-border shadow-xl">
              {/* Guest option - always shown at top */}
              <button
                type="button"
                onClick={() => {
                  onSetAsGuest();
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
              >
                <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center">
                  <span className="text-text-2 text-sm">👤</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-1">Add as Guest</p>
                  <p className="text-xs text-text-2">Player without account</p>
                </div>
              </button>

              {/* Search results */}
              {results.length > 0 && (
                <>
                  {results.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => handleSelect(player)}
                      className="w-full p-2 flex items-center gap-2 text-left hover:bg-card-raised transition-colors"
                    >
                      {player.avatarUrl ? (
                        <img
                          src={player.avatarUrl}
                          alt={player.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center">
                          <span className="text-text-2 text-xs font-medium">
                            {player.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-1">
                          {player.displayName || player.username}
                        </p>
                        <p className="text-xs text-text-2">@{player.username}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* No results message */}
              {query.length >= 2 && results.length === 0 && !isLoading && (
                <div className="p-2 text-center text-sm text-text-2">
                  No players found
                </div>
              )}

              {/* Hint when no query */}
              {query.length < 2 && (
                <div className="p-2 text-center text-xs text-text-2">
                  Type to search for players
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Filled slot - show player card
  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-all",
        slot.isWinner
          ? "bg-win/10 border-win/50"
          : "bg-card border-card-border"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0">
          {slot.type === "registered" && slot.avatarUrl ? (
            <img
              src={slot.avatarUrl}
              alt={slot.username}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-card-raised flex items-center justify-center">
              <span className="text-text-2 text-sm font-medium">
                {slot.type === "registered"
                  ? slot.username?.charAt(0).toUpperCase()
                  : "👤"}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {slot.type === "registered" ? (
            <>
              <p className="text-sm font-medium text-text-1 truncate">
                {slot.displayName || slot.username}
              </p>
              <p className="text-xs text-text-2">@{slot.username}</p>
            </>
          ) : (
            <Input
              value={slot.placeholderName || ""}
              onChange={(e) => onChangePlaceholderName(e.target.value)}
              placeholder="Guest name"
              className="h-8 text-sm"
              autoFocus
            />
          )}

          {/* Commander search for placeholder/guest players */}
          {slot.type === "placeholder" && (
            <div className="relative mt-2">
              {slot.commanderName ? (
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex-1 h-8 text-sm rounded-md border px-2 flex items-center",
                    "bg-accent/10 border-accent/30 text-text-1"
                  )}>
                    {slot.commanderName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChangeCommanderName("")}
                    className="p-1 text-text-2 hover:text-loss transition-colors"
                    title="Clear commander"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={commanderQuery}
                    onChange={(e) => setCommanderQuery(e.target.value)}
                    onFocus={() => commanderResults.length > 0 && setIsCommanderOpen(true)}
                    onBlur={() => setTimeout(() => setIsCommanderOpen(false), 200)}
                    placeholder="Search commander..."
                    className="h-8 text-sm"
                  />
                  {isCommanderLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    </div>
                  )}
                  {isCommanderOpen && commanderResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card border border-card-border shadow-xl max-h-48 overflow-y-auto">
                      {commanderResults.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => handleCommanderSelect(card)}
                          className="w-full p-2 text-left hover:bg-card-raised transition-colors text-sm text-text-1 truncate"
                        >
                          {card.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Deck selector for registered users */}
          {slot.type === "registered" && availableDecks.length > 0 && (
            <select
              value={slot.deckId || ""}
              onChange={(e) => onSelectDeck(e.target.value)}
              className={cn(
                "mt-2 w-full h-8 text-sm rounded-md border px-2",
                slot.deckId 
                  ? "bg-accent/10 border-accent/30 text-text-1" 
                  : "bg-card border-card-border text-text-2"
              )}
            >
              <option value="">Select commander...</option>
              {availableDecks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.commanderName}{deck.deckName ? ` (${deck.deckName})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onToggleWinner}
            className={cn(
              "p-1.5 rounded transition-colors text-xs",
              slot.isWinner
                ? "bg-win text-text-1"
                : "bg-card-raised text-text-2 hover:text-text-1"
            )}
            title={slot.isWinner ? "Remove winner" : "Mark as winner"}
          >
            🏆
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded bg-card-raised text-text-2 hover:text-loss hover:bg-loss/10 transition-colors text-xs"
            title="Clear"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface MatchFormProps {
  formats: FormatSummary[];
  currentUserId: string;
  currentUserDecks: DeckSummary[];
  className?: string;
}

export function MatchForm({
  formats,
  currentUserId,
  currentUserDecks,
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

  // Add a registered player to the first empty slot (legacy, kept for compatibility)
  const addRegisteredPlayer = React.useCallback(
    async (player: SearchResult) => {
      const emptyIndex = participants.findIndex((p) => p.type === "empty");
      if (emptyIndex === -1) return;
      await addRegisteredPlayerAt(emptyIndex, player);
    },
    [participants, addRegisteredPlayerAt]
  );

  // Add a placeholder to the first empty slot (legacy, kept for compatibility)
  const addPlaceholder = React.useCallback(() => {
    const emptyIndex = participants.findIndex((p) => p.type === "empty");
    if (emptyIndex === -1) return;
    setAsGuestAt(emptyIndex);
  }, [participants, setAsGuestAt]);

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

  // Toggle winner status
  const toggleWinner = (index: number) => {
    const newParticipants = [...participants];
    newParticipants[index] = {
      ...newParticipants[index],
      isWinner: !newParticipants[index].isWinner,
    };
    setParticipants(newParticipants);
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
      const supabase = createClient();

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

      // Create match via API or direct Supabase call
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          created_by: currentUserId,
          format_id: selectedFormat!.id,
          played_at: new Date(playedAt).toISOString(),
          notes: notes || null,
          match_data: buildMatchData(),
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Create participants
      const participantInserts = participantInputs.map((p, index) => {
        const isWinner = adjustedWinnerIndices.includes(index);
        const baseData = {
          match_id: match.id,
          is_winner: isWinner,
          team: p.team || null,
          participant_data: { format: selectedFormat!.slug },
        };

        if (p.type === "registered") {
          return {
            ...baseData,
            user_id: p.userId,
            deck_id: p.deckId,
            placeholder_name: null,
            confirmed_at:
              p.userId === currentUserId ? new Date().toISOString() : null,
          };
        } else {
          return {
            ...baseData,
            user_id: null,
            deck_id: null,
            placeholder_name: p.placeholderName,
            confirmed_at: null,
          };
        }
      });

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participantInserts);

      if (participantsError) {
        // Rollback match
        await supabase.from("matches").delete().eq("id", match.id);
        throw participantsError;
      }

      // Navigate to the new match
      router.push(`/match/${match.id}`);
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

  // Can add more players?
  const canAddPlayers =
    selectedFormat &&
    (!selectedFormat.maxPlayers ||
      participants.length < selectedFormat.maxPlayers);

  // Is FFA format with flexible player count?
  const isFlexibleFormat =
    selectedFormat?.slug === "ffa" && !selectedFormat.maxPlayers;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
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
              <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr] gap-4">
                {/* Team A */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-card-border">
                    <div className="w-3 h-3 rounded-full bg-accent" />
                    <span className="text-sm font-semibold text-text-1">Team A</span>
                  </div>
                  {participants
                    .map((slot, index) => ({ slot, index }))
                    .filter(({ index }) => getTeamForIndex(index) === "A")
                    .map(({ slot, index }) => (
                      <PlayerSlot
                        key={index}
                        slot={slot}
                        index={index}
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
                  <div className="flex items-center gap-2 pb-2 border-b border-card-border">
                    <div className="w-3 h-3 rounded-full bg-loss" />
                    <span className="text-sm font-semibold text-text-1">Team B</span>
                  </div>
                  {participants
                    .map((slot, index) => ({ slot, index }))
                    .filter(({ index }) => getTeamForIndex(index) === "B")
                    .map(({ slot, index }) => (
                      <PlayerSlot
                        key={index}
                        slot={slot}
                        index={index}
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
                      />
                    ))}
                </div>
              </div>
            ) : (
              /* Non-team layout (FFA, Pentagram) */
              <div className="space-y-3">
                {participants.map((slot, index) => (
                  <PlayerSlot
                    key={index}
                    slot={slot}
                    index={index}
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
