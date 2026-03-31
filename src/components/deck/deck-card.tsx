"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ColorIdentity } from "@/components/ui/mana-pip";
import { BracketIndicator } from "@/components/ui/bracket-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { buildCommanderImageUrl } from "@/lib/scryfall/api";
import type { DeckWithStats } from "@/types";
import type { ManaColor } from "@/app/_design-system";

interface DeckCardProps {
  deck: DeckWithStats;
  className?: string;
}

/**
 * Deck card for the deck manager grid.
 * Displays commander image, name, colors, bracket, and win/loss stats.
 */
export function DeckCard({ deck, className }: DeckCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const imageUrl = buildCommanderImageUrl(deck.commanderName, "art_crop");
  const displayName = deck.deckName || deck.commanderName;
  const hasPartner = !!deck.partnerName;

  return (
    <Link href={`/decks/${deck.id}/edit`}>
      <Card
        className={cn(
          "overflow-hidden group hover:ring-2 hover:ring-accent/50 transition-all duration-200",
          !deck.isActive && "opacity-60",
          className
        )}
      >
        {/* Commander artwork header */}
        <div className="relative h-36 bg-surface overflow-hidden">
          {/* Loading skeleton */}
          {isLoading && imageUrl && (
            <Skeleton className="absolute inset-0" />
          )}

          {/* Commander art */}
          {imageUrl && !imageError ? (
            <Image
              src={imageUrl}
              alt={deck.commanderName}
              fill
              className={cn(
                "object-cover object-top transition-all duration-300",
                "group-hover:scale-105",
                isLoading ? "opacity-0" : "opacity-100"
              )}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setImageError(true);
                setIsLoading(false);
              }}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-raised">
              <span className="text-4xl">🎴</span>
            </div>
          )}

          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-linear-to-t from-card to-transparent" />

          {/* Inactive badge */}
          {!deck.isActive && (
            <Badge
              variant="default"
              className="absolute top-2 right-2 bg-bg-overlay/80 backdrop-blur-sm"
            >
              Retired
            </Badge>
          )}
        </div>

        <CardContent className="p-4 py-3 space-y-3">
          {/* Deck name and commander info */}
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-text-1 truncate group-hover:text-accent transition-colors">
              {displayName}
            </h3>
            {deck.deckName && (
              <p className="text-xs text-text-2 truncate">
                {deck.commanderName}
                {hasPartner && ` & ${deck.partnerName}`}
              </p>
            )}
            {!deck.deckName && hasPartner && (
              <p className="text-xs text-text-2 truncate">
                & {deck.partnerName}
              </p>
            )}
          </div>

          {/* Color identity and bracket */}
          <div className="flex items-center justify-between">
            <ColorIdentity colors={deck.colorIdentity as ManaColor[]} />
            <BracketIndicator bracket={deck.bracket} size="sm" />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between pt-2 border-t border-card-border">
            <div className="flex items-center gap-3 text-xs text-text-2">
              <span>{deck.stats.gamesPlayed} games</span>
              <span>
                <span className="text-positive">{deck.stats.wins}W</span>
                {" / "}
                <span className="text-negative">{deck.stats.losses}L</span>
              </span>
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                deck.stats.winRate >= 50 ? "text-positive" : "text-text-2"
              )}
            >
              {deck.stats.winRate}%
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Skeleton loading state for DeckCard
 */
export function DeckCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-32" />
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-card-border">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
