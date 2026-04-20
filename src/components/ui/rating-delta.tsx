"use client";

import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";

interface RatingDeltaProps {
  delta: number;
  size?: "sm" | "md" | "lg";
  showSign?: boolean;
  /** True if this is a preview (not yet confirmed) rating change */  
  isPreview?: boolean;
  /** Enable counting animation */
  animated?: boolean;
  className?: string;
}

/**
 * Displays a rating change with semantic coloring.
 * Positive deltas are green, negative are red, zero is neutral.
 * 
 * Per design requirements: always shows sign (+12, −8), never just "12"
 * Preview ratings are shown with reduced opacity to indicate they're estimates.
 */
export function RatingDelta({ 
  delta, 
  size = "md", 
  showSign = true,
  isPreview = false,
  animated = false,
  className 
}: RatingDeltaProps) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isNeutral = delta === 0;

  // Format with proper minus sign (−) not hyphen (-)
  const formattedDelta = isNeutral
    ? "+0"
    : isPositive
    ? `+${delta}`
    : `−${Math.abs(delta)}`;

  const sizeClasses = {
    sm: "text-sm",        // 11px
    md: "text-delta",     // 18px Chakra Petch
    lg: "text-3xl",       // 24px
  };

  const baseClasses = cn(
    "font-display font-bold tabular-nums",
    sizeClasses[size],
    isPositive && "text-win",
    isNegative && "text-loss",
    isNeutral && "text-text-2",
    isPreview && "opacity-50",
    className
  );

  if (animated && !isNeutral) {
    return (
      <span
        className={baseClasses}
        aria-label={`${isPreview ? "Estimated " : ""}Rating change: ${isPositive ? "plus" : isNegative ? "minus" : ""} ${Math.abs(delta)}`}
        title={isPreview ? "Preview — will be confirmed after match is accepted" : undefined}
      >
        <AnimatedNumber
          value={Math.abs(delta)}
          prefix={isPositive ? "+" : "−"}
          formatLocale={false}
        />
      </span>
    );
  }

  return (
    <span
      className={baseClasses}
      aria-label={`${isPreview ? "Estimated " : ""}Rating change: ${isPositive ? "plus" : isNegative ? "minus" : ""} ${Math.abs(delta)}`}
      title={isPreview ? "Preview — will be confirmed after match is accepted" : undefined}
    >
      {showSign ? formattedDelta : Math.abs(delta)}
    </span>
  );
}

interface RatingDisplayProps {
  rating: number;
  delta?: number;
  size?: "sm" | "md" | "lg" | "hero";
  /** Enable counting animation for the rating value */
  animated?: boolean;
  className?: string;
}

/**
 * Displays a rating value, optionally with delta.
 * Hero size is used for the main dashboard ELO display.
 * Set `animated` to enable smooth counting animation.
 */
export function RatingDisplay({ rating, delta, size = "md", animated = false, className }: RatingDisplayProps) {
  const sizeClasses = {
    sm: "text-base",      // 13px
    md: "text-xl",        // 16px
    lg: "text-stat",      // 24px Chakra Petch
    hero: "text-elo",     // 56px Chakra Petch
  };

  return (
    <div className={cn("inline-flex items-baseline gap-2", className)}>
      {animated ? (
        <AnimatedNumber
          value={rating}
          className={cn(
            "font-display font-bold text-text-1",
            sizeClasses[size]
          )}
        />
      ) : (
        <span
          className={cn(
            "font-display font-bold tabular-nums text-text-1",
            sizeClasses[size]
          )}
        >
          {rating.toLocaleString()}
        </span>
      )}
      {delta !== undefined && delta !== 0 && (
        <RatingDelta delta={delta} size={size === "hero" ? "lg" : "sm"} animated={animated} />
      )}
    </div>
  );
}
