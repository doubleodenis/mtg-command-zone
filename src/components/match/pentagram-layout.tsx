"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { searchCommanders, type ScryfallCard } from "@/lib/scryfall/api";
import { getFriendshipStatus, sendFriendRequest, getFriends } from "@/lib/supabase/profiles";
import type {
  PentagonPlayerCardProps,
  PentagramLayoutProps,
  SearchResult,
} from "./match-form-types";

// Pentagon vertex positions (percentage from center, with top vertex at 12 o'clock)
// Using a coordinate system where center is (50, 50)
const PENTAGON_POSITIONS = [
  { x: 50, y: 8 },    // 0: Top
  { x: 88, y: 35 },   // 1: Top-right
  { x: 73, y: 85 },   // 2: Bottom-right
  { x: 27, y: 85 },   // 3: Bottom-left
  { x: 12, y: 35 },   // 4: Top-left
];

// Enemy pairs for each position (the two non-adjacent players)
const PENTAGRAM_ENEMIES: Record<number, [number, number]> = {
  0: [2, 3],
  1: [3, 4],
  2: [4, 0],
  3: [0, 1],
  4: [1, 2],
};

function PentagonPlayerCard({
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
  excludeIds,
  currentUser,
  isEnemyHighlighted,
  onFocusChange,
}: PentagonPlayerCardProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [sendingRequestTo, setSendingRequestTo] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Friends state for showing friends first in dropdown
  const [friends, setFriends] = React.useState<SearchResult[]>([]);
  const [friendsLoaded, setFriendsLoaded] = React.useState(false);
  const [isFriendsLoading, setIsFriendsLoading] = React.useState(false);

  // Load friends when dropdown opens
  React.useEffect(() => {
    if (!isOpen || friendsLoaded || slot.type !== "empty") return;

    const loadFriends = async () => {
      setIsFriendsLoading(true);
      try {
        const supabase = createClient();
        const result = await getFriends(supabase, currentUserId);
        if (result.success) {
          const friendResults: SearchResult[] = result.data.map((f) => ({
            id: f.id,
            username: f.username,
            displayName: f.displayName,
            avatarUrl: f.avatarUrl,
            friendshipStatus: "accepted",
            isFriend: true,
          }));
          setFriends(friendResults);
        }
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setFriendsLoaded(true);
        setIsFriendsLoading(false);
      }
    };

    loadFriends();
  }, [isOpen, friendsLoaded, slot.type, currentUserId]);

  // Commander search for placeholders
  const [commanderQuery, setCommanderQuery] = React.useState("");
  const [commanderResults, setCommanderResults] = React.useState<ScryfallCard[]>([]);
  const [isCommanderLoading, setIsCommanderLoading] = React.useState(false);
  const [isCommanderOpen, setIsCommanderOpen] = React.useState(false);
  const commanderTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Player search effect
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
          .select("id, username, display_name, avatar_url")
          .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
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
                displayName: p.display_name,
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

  const handleSendFriendRequest = async (e: React.MouseEvent, playerId: string) => {
    e.stopPropagation();
    setSendingRequestTo(playerId);
    try {
      const supabase = createClient();
      const result = await sendFriendRequest(supabase, currentUserId, playerId);
      if (result.success) {
        setResults((prev) =>
          prev.map((r) =>
            r.id === playerId ? { ...r, friendshipStatus: "pending" } : r
          )
        );
      }
    } catch (error) {
      console.error("Failed to send friend request:", error);
    } finally {
      setSendingRequestTo(null);
    }
  };

  // Commander search effect
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
        setCommanderResults(commanders.slice(0, 5));
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

  // Empty slot
  if (slot.type === "empty") {
    return (
      <div 
        className={cn(
          "w-full p-3 rounded-lg border border-dashed bg-card-raised/30 transition-colors",
          isEnemyHighlighted ? "border-loss/70 bg-loss/5" : "border-card-border"
        )}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
      >
        <div className={cn(
          "text-sm mb-2 text-center font-medium",
          isEnemyHighlighted ? "text-loss" : "text-text-2"
        )}>
          Seat {index + 1}{isEnemyHighlighted && " — Enemy"}
        </div>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsOpen(true);
              onFocusChange?.(true);
            }}
            onBlur={() => {
              setTimeout(() => setIsOpen(false), 200);
              onFocusChange?.(false);
            }}
            placeholder="Add player..."
            className="h-9 text-sm"
          />
          {isOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl text-sm">
              {/* Add yourself option */}
              {currentUser && !excludeIds.includes(currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectPlayer(currentUser);
                    setQuery("");
                    setIsOpen(false);
                  }}
                  className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors border-b border-card-border"
                >
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent/20 text-xs flex items-center justify-center text-accent">
                      {currentUser.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-text-1">Add yourself</span>
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
                <span>👤</span>
                <span className="text-text-1">Guest</span>
              </button>
              {results.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 p-2 hover:bg-accent/10 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPlayer(player);
                      setQuery("");
                      setIsOpen(false);
                    }}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                  >
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-card-raised text-xs flex items-center justify-center shrink-0">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-text-1 truncate">{player.username}</span>
                  </button>
                  {/* Friend status / Add friend button */}
                  <div className="shrink-0">
                    {player.isFriend ? (
                      <span className="text-xs text-win">✓</span>
                    ) : player.friendshipStatus === "pending" ? (
                      <span className="text-xs text-text-3">•••</span>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-accent hover:text-accent"
                        onClick={(e) => handleSendFriendRequest(e, player.id)}
                        disabled={sendingRequestTo === player.id}
                      >
                        +
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {/* Friends section when not searching */}
              {query.length < 2 && (
                <>
                  {isFriendsLoading && (
                    <div className="p-2 text-center text-text-2">
                      Loading...
                    </div>
                  )}
                  {!isFriendsLoading && friends.filter((f) => !excludeIds.includes(f.id)).length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-text-3 font-medium border-b border-card-border">
                        Friends
                      </div>
                      {friends
                        .filter((f) => !excludeIds.includes(f.id))
                        .map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              onSelectPlayer(player);
                              setQuery("");
                              setIsOpen(false);
                            }}
                            className="w-full p-2 flex items-center gap-2 text-left hover:bg-accent/10 transition-colors"
                          >
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-card-raised text-xs flex items-center justify-center">
                                {player.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-text-1 truncate flex-1">{player.displayName || player.username}</span>
                            <span className="text-xs text-win">✓</span>
                          </button>
                        ))}
                    </>
                  )}
                </>
              )}
              {query.length >= 2 && results.length === 0 && !isLoading && (
                <div className="p-2 text-center text-text-2">No results</div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Filled slot
  const displayName = slot.type === "registered" 
    ? (slot.displayName || slot.username || "Player")
    : (slot.placeholderName || "Guest");

  return (
    <div
      className={cn(
        "w-full p-3 rounded-lg border transition-all",
        isEnemyHighlighted 
          ? "bg-loss/10 border-loss/50" 
          : slot.isWinner 
            ? "bg-win/10 border-win/50" 
            : "bg-card border-card-border"
      )}
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    >
      {/* Enemy indicator for mobile */}
      {isEnemyHighlighted && (
        <div className="text-xs text-loss font-medium mb-2 text-center">⚔️ Enemy</div>
      )}
      {/* Top row: avatar and actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {slot.type === "registered" && slot.avatarUrl ? (
            <img src={slot.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-card-raised flex items-center justify-center text-sm text-text-2">
              {slot.type === "registered" ? displayName.charAt(0).toUpperCase() : "👤"}
            </div>
          )}
          {slot.type === "registered" && (
            <span className="text-sm font-medium text-text-1 truncate">{displayName}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleWinner}
            className={cn(
              "p-1.5 rounded text-sm",
              slot.isWinner ? "bg-win text-text-1" : "text-text-2 hover:text-text-1"
            )}
          >
            🏆
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded text-sm text-text-2 hover:text-loss"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Name input for guests */}
      {slot.type === "placeholder" && (
        <Input
          value={slot.placeholderName || ""}
          onChange={(e) => onChangePlaceholderName(e.target.value)}
          placeholder="Guest name"
          className="h-9 text-sm mb-2"
        />
      )}

      {/* Deck/Commander selection */}
      {slot.type === "registered" && availableDecks.length > 0 && (
        <Select
          value={slot.deckId || ""}
          onChange={(value) => onSelectDeck(value)}
          placeholder="Commander..."
          options={availableDecks.map((deck) => ({
            value: deck.id,
            label: deck.commanderName,
          }))}
        />
      )}

      {/* No decks message for registered users */}
      {slot.type === "registered" && availableDecks.length === 0 && (
        <div className="p-1.5 rounded bg-card-raised border border-card-border">
          <p className="text-xs text-text-2 text-center">Deck TBD</p>
        </div>
      )}

      {slot.type === "placeholder" && (
        <div className="relative">
          {slot.commanderName ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 h-8 text-sm rounded border px-2 flex items-center bg-accent/10 border-accent/30 text-text-1 truncate">
                {slot.commanderName}
              </span>
              <button
                type="button"
                onClick={() => onChangeCommanderName("")}
                className="text-sm text-text-2 hover:text-loss"
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
                placeholder="Commander..."
                className="h-8 text-sm px-2"
              />
              {isCommanderOpen && commanderResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg overflow-hidden bg-card-raised border border-accent/30 shadow-xl max-h-40 overflow-y-auto">
                  {commanderResults.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        onChangeCommanderName(card.name);
                        setCommanderQuery("");
                        setIsCommanderOpen(false);
                      }}
                      className="w-full p-2 text-left hover:bg-accent/10 transition-colors text-sm text-text-1 truncate"
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
    </div>
  );
}

export function PentagramLayout({
  participants,
  currentUserId,
  onSelectPlayer,
  onSetAsGuest,
  onRemove,
  onToggleWinner,
  onSelectDeck,
  onChangePlaceholderName,
  onChangeCommanderName,
  userDecks,
  excludeIds,
  currentUser,
}: PentagramLayoutProps) {
  // Track which card is focused on mobile to highlight enemies
  const [focusedIndex, setFocusedIndex] = React.useState<number | null>(null);

  // Compute which indices are enemies of the focused card
  const enemyIndices = focusedIndex !== null ? PENTAGRAM_ENEMIES[focusedIndex] : null;

  return (
    <>
      {/* Desktop: Pentagram visual layout */}
      <div className="hidden md:block relative w-full aspect-square max-w-xl mx-auto">
        {/* SVG for pentagram lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          {/* Pentagon outline */}
          <polygon
            points={PENTAGON_POSITIONS.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-card-border"
          />
          {/* Star lines (connecting enemies) - the pentagram */}
          {[0, 1, 2, 3, 4].map((i) => {
            const from = PENTAGON_POSITIONS[i];
            const to1 = PENTAGON_POSITIONS[PENTAGRAM_ENEMIES[i][0]];
            return (
              <g key={i}>
                <line
                  x1={from.x} y1={from.y}
                  x2={to1.x} y2={to1.y}
                  stroke="currentColor"
                  strokeWidth="0.3"
                  strokeDasharray="2,2"
                  className="text-loss/50"
                />
              </g>
            );
          })}
        </svg>

        {/* Player cards at each vertex */}
        {participants.slice(0, 5).map((slot, index) => {
          const pos = PENTAGON_POSITIONS[index];
          return (
            <div
              key={index}
              className="absolute w-40 lg:w-52 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              <PentagonPlayerCard
                slot={slot}
                index={index}
                currentUserId={currentUserId}
                onSelectPlayer={(player) => onSelectPlayer(index, player)}
                onSetAsGuest={() => onSetAsGuest(index)}
                onRemove={() => onRemove(index)}
                onToggleWinner={() => onToggleWinner(index)}
                onSelectDeck={(deckId) => onSelectDeck(index, deckId)}
                onChangePlaceholderName={(name) => onChangePlaceholderName(index, name)}
                onChangeCommanderName={(name) => onChangeCommanderName(index, name)}
                availableDecks={
                  slot.type === "registered" && slot.userId
                    ? userDecks[slot.userId] || []
                    : []
                }
                excludeIds={excludeIds}
                enemies={PENTAGRAM_ENEMIES[index]}
                currentUser={currentUser}
                isEnemyHighlighted={enemyIndices?.includes(index) ?? false}
                onFocusChange={(focused) => setFocusedIndex(focused ? index : null)}
              />
            </div>
          );
        })}
      </div>

      {/* Mobile: Stacked list layout */}
      <div className="md:hidden space-y-3">
        {participants.slice(0, 5).map((slot, index) => (
          <PentagonPlayerCard
            key={index}
            slot={slot}
            index={index}
            currentUserId={currentUserId}
            onSelectPlayer={(player) => onSelectPlayer(index, player)}
            onSetAsGuest={() => onSetAsGuest(index)}
            onRemove={() => onRemove(index)}
            onToggleWinner={() => onToggleWinner(index)}
            onSelectDeck={(deckId) => onSelectDeck(index, deckId)}
            onChangePlaceholderName={(name) => onChangePlaceholderName(index, name)}
            onChangeCommanderName={(name) => onChangeCommanderName(index, name)}
            availableDecks={
              slot.type === "registered" && slot.userId
                ? userDecks[slot.userId] || []
                : []
            }
            excludeIds={excludeIds}
            enemies={PENTAGRAM_ENEMIES[index]}
            currentUser={currentUser}
            isEnemyHighlighted={enemyIndices?.includes(index) ?? false}
            onFocusChange={(focused) => setFocusedIndex(focused ? index : null)}
          />
        ))}
      </div>
    </>
  );
}
