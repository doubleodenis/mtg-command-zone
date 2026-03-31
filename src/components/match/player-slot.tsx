"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { searchCommanders, type ScryfallCard } from "@/lib/scryfall/api";
import { getFriendshipStatus, sendFriendRequest } from "@/lib/supabase/profiles";
import type { PlayerSlotProps, SearchResult } from "./match-form-types";

export function PlayerSlot({
  slot,
  index,
  currentUserId,
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
  currentUser,
}: PlayerSlotProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [sendingRequestTo, setSendingRequestTo] = React.useState<string | null>(null);
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
          // Get friendship status for each result
          const resultsWithStatus = await Promise.all(
            data.map(async (p) => {
              const statusResult = await getFriendshipStatus(supabase, currentUserId, p.id);
              const friendship = statusResult.success ? statusResult.data : null;
              return {
                id: p.id,
                username: p.username,
                displayName: null,
                avatarUrl: p.avatar_url,
                friendshipStatus: friendship?.status ?? null,
                isFriend: friendship?.status === "accepted",
              };
            })
          );
          setResults(resultsWithStatus);
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
  }, [query, excludeIds, slot.type, currentUserId]);

  const handleSelect = (player: SearchResult) => {
    onSelectPlayer(player);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  const handleSendFriendRequest = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation(); // Don't trigger player selection
    setSendingRequestTo(playerId);
    try {
      const supabase = createClient();
      const result = await sendFriendRequest(supabase, currentUserId, playerId);
      if (result.success) {
        // Update local state to show request sent
        setResults((prev) =>
          prev.map((r) =>
            r.id === playerId
              ? { ...r, friendshipStatus: "pending" }
              : r
          )
        );
      }
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setSendingRequestTo(null);
    }
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
              {/* Add yourself option */}
              {currentUser && !excludeIds.includes(currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelect(currentUser);
                  }}
                  className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
                >
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <span className="text-accent text-xs font-medium">
                        {currentUser.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-1">Add yourself</p>
                    <p className="text-xs text-text-2">@{currentUser.username}</p>
                  </div>
                </button>
              )}

              {/* Guest option */}
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
                    <div
                      key={player.id}
                      className="flex items-center gap-2 p-2 hover:bg-card-raised transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelect(player)}
                        className="flex-1 flex items-center gap-2 text-left"
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
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-1 truncate">
                            {player.displayName || player.username}
                          </p>
                          <p className="text-xs text-text-2">@{player.username}</p>
                        </div>
                      </button>
                      {/* Friend status / Add friend button */}
                      <div className="shrink-0">
                        {player.isFriend ? (
                          <span className="text-xs text-win font-medium px-2">Friend</span>
                        ) : player.friendshipStatus === "pending" ? (
                          <span className="text-xs text-text-3 px-2">Pending</span>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-accent hover:text-accent"
                            onClick={(e) => handleSendFriendRequest(e, player.id)}
                            disabled={sendingRequestTo === player.id}
                          >
                            {sendingRequestTo === player.id ? "..." : "+ Friend"}
                          </Button>
                        )}
                      </div>
                    </div>
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

          {/* No decks message for registered users */}
          {slot.type === "registered" && availableDecks.length === 0 && (
            <div className="mt-2 p-2 rounded-md bg-card-raised border border-card-border">
              <p className="text-xs text-text-2">
                Deck TBD • Player will set during confirmation
              </p>
            </div>
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
