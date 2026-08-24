"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchResult } from "./match-form-types";

export type SidebarTab = "friends" | "collection";

export type PlayerSidebarProps = {
  friends: SearchResult[];
  collectionMembers: SearchResult[];
  hasSelectedCollections: boolean;
  excludeIds: string[];
  onClickAdd: (player: SearchResult) => void;
  className?: string;
};

function playerLabel(player: SearchResult) {
  return player.displayName || player.username;
}

export function PlayerSidebar({
  friends,
  collectionMembers,
  hasSelectedCollections,
  excludeIds,
  onClickAdd,
  className,
}: PlayerSidebarProps) {
  const [activeTab, setActiveTab] = React.useState<SidebarTab>("friends");
  const [query, setQuery] = React.useState("");

  const activeList = activeTab === "friends" ? friends : collectionMembers;

  const visiblePlayers = activeList.filter((player) => {
    if (excludeIds.includes(player.id)) return false;
    if (!query.trim()) return true;
    const haystack =
      `${player.displayName ?? ""} ${player.username}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Add Players</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-card-raised border-card-border flex gap-1 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setActiveTab("friends")}
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
              activeTab === "friends"
                ? "bg-accent text-text-1"
                : "text-text-2 hover:text-text-1",
            )}
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => hasSelectedCollections && setActiveTab("collection")}
            disabled={!hasSelectedCollections}
            title={
              hasSelectedCollections
                ? undefined
                : "Select a collection above to browse its members"
            }
            className={cn(
              "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
              !hasSelectedCollections && "cursor-not-allowed opacity-40",
              activeTab === "collection"
                ? "bg-accent text-text-1"
                : "text-text-2 hover:text-text-1",
            )}
          >
            Collection
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter players..."
          className="bg-card border-card-border text-text-1 placeholder:text-text-2 focus:border-accent-ring focus:ring-accent-ring w-full rounded-md border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
        />

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {visiblePlayers.length === 0 && (
            <p className="text-text-2 py-4 text-center text-xs">
              {activeTab === "collection" && !hasSelectedCollections
                ? "Select a collection to see its members here."
                : "No players to show."}
            </p>
          )}
          {visiblePlayers.map((player) => (
            <DraggableSidebarRow key={player.id} player={player} onClickAdd={onClickAdd} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DraggableSidebarRow({
  player,
  onClickAdd,
}: {
  player: SearchResult;
  onClickAdd: (player: SearchResult) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({ id: `sidebar:${player.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "hover:bg-card-raised flex w-full items-center gap-1 rounded-md transition-colors",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        onClick={() => onClickAdd(player)}
        className="flex flex-1 items-center gap-2 p-2 text-left"
      >
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full"
          />
        ) : (
          <div className="bg-card-raised h-6 w-6 shrink-0 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="text-text-1 truncate text-sm">
            {playerLabel(player)}
          </p>
          <p className="text-text-2 truncate text-xs">
            @{player.username}
          </p>
        </div>
      </button>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Drag to add this player"
        className="text-text-2 hover:text-text-1 shrink-0 cursor-grab p-2 touch-none active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}
