"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { buildCommanderImageUrl } from "@/lib/scryfall/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type CommanderCardSize = "sm" | "md" | "lg";

interface CommanderCardProps {
  /** Commander card name - used to fetch image from Scryfall */
  commanderName: string | null;
  /** Partner commander name (optional) */
  partnerName?: string | null;
  /** Player display name */
  playerName: string;
  /** Player avatar URL (optional fallback when no commander) */
  avatarUrl?: string | null;
  /** Whether this player won the match */
  isWinner?: boolean;
  /** Whether this is a guest player */
  isGuest?: boolean;
  /** Size variant */
  size?: CommanderCardSize;
  /** Additional className */
  className?: string;
  /** Optional link to player profile */
  href?: string;
}

const sizeConfig = {
  sm: {
    card: "w-20",
    image: { width: 80, height: 112 },
    name: "text-xs",
    commander: "text-[10px]",
  },
  md: {
    card: "w-28",
    image: { width: 112, height: 156 },
    name: "text-sm",
    commander: "text-xs",
  },
  lg: {
    card: "w-36",
    image: { width: 144, height: 200 },
    name: "text-base",
    commander: "text-sm",
  },
} as const;

export function CommanderCard({
  commanderName,
  partnerName,
  playerName,
  avatarUrl,
  isWinner = false,
  isGuest = false,
  size = "md",
  className,
  href,
}: CommanderCardProps) {
  const [imageError, setImageError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const config = sizeConfig[size];

  const imageUrl = commanderName
    ? buildCommanderImageUrl(commanderName, "normal")
    : null;

  const handleImageLoad = () => setIsLoading(false);
  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "group relative flex flex-col items-center",
        config.card,
        href && "cursor-pointer",
        className
      )}
    >
      {/* Winner crown indicator */}
      {isWinner && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 text-gold text-lg drop-shadow-lg">
          👑
        </div>
      )}

      {/* Card image container */}
      <div
        className={cn(
          "relative rounded-lg overflow-hidden bg-card border border-card-border",
          "transition-all duration-200",
          isWinner && "ring-2 ring-gold/50 shadow-lg shadow-gold/20",
          href && "group-hover:ring-2 group-hover:ring-accent/50"
        )}
        style={{
          width: config.image.width,
          height: config.image.height,
        }}
      >
        {/* Loading skeleton */}
        {isLoading && imageUrl && (
          <Skeleton className="absolute inset-0 rounded-lg" />
        )}

        {/* Commander card image */}
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={commanderName ?? "Commander"}
            fill
            className={cn(
              "object-cover transition-opacity duration-200",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleImageLoad}
            onError={handleImageError}
            unoptimized // Scryfall images are already optimized
          />
        ) : (
          // Fallback: player avatar or initials
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-raised">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={playerName}
                fill
                className="object-cover opacity-50"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-text-3">
                <div className="text-2xl">🎴</div>
                <span className="text-xs text-center px-2">
                  {commanderName ? "Image unavailable" : "No commander"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Partner indicator */}
        {partnerName && (
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] px-1 rounded">
            +Partner
          </div>
        )}
      </div>

      {/* Player name */}
      <div
        className={cn(
          "mt-2 font-medium text-text-1 text-center truncate w-full",
          config.name
        )}
      >
        {playerName}
      </div>

      {/* Commander name (truncated) */}
      {commanderName && (
        <div
          className={cn(
            "text-text-3 text-center truncate w-full leading-tight",
            config.commander
          )}
          title={partnerName ? `${commanderName} & ${partnerName}` : commanderName}
        >
          {commanderName}
          {partnerName && (
            <span className="block truncate">& {partnerName}</span>
          )}
        </div>
      )}

      {/* Guest badge */}
      {isGuest && (
        <Badge variant="outline" className="mt-1 text-[10px]">
          Guest
        </Badge>
      )}
    </Wrapper>
  );
}
