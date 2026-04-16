import { cn } from "@/lib/utils";

interface RatingDeltaProps {
  delta: number;
  size?: "sm" | "md" | "lg";
  showSign?: boolean;
  /** True if this is a preview (not yet confirmed) rating change */  
  isPreview?: boolean;
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

  return (
    <span
      className={cn(
        "font-display font-bold tabular-nums",
        sizeClasses[size],
        isPositive && "text-win",
        isNegative && "text-loss",
        isNeutral && "text-text-2",
        isPreview && "opacity-50",
        className
      )}
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
  className?: string;
}

/**
 * Displays a rating value, optionally with delta.
 * Hero size is used for the main dashboard ELO display.
 */
export function RatingDisplay({ rating, delta, size = "md", className }: RatingDisplayProps) {
  const sizeClasses = {
    sm: "text-base",      // 13px
    md: "text-xl",        // 16px
    lg: "text-stat",      // 24px Chakra Petch
    hero: "text-elo",     // 56px Chakra Petch
  };

  return (
    <div className={cn("inline-flex items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-display font-bold tabular-nums text-text-1",
          sizeClasses[size]
        )}
      >
        {rating.toLocaleString()}
      </span>
      {delta !== undefined && delta !== 0 && (
        <RatingDelta delta={delta} size={size === "hero" ? "lg" : "sm"} />
      )}
    </div>
  );
}
