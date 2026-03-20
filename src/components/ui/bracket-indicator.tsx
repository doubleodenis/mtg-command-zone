import { cn } from "@/lib/utils";

export type Bracket = 1 | 2 | 3 | 4;

interface BracketIndicatorProps {
  bracket: Bracket;
  size?: "sm" | "md";
  className?: string;
}

const bracketDescriptions: Record<Bracket, string> = {
  1: "Casual — Precons & low-power decks",
  2: "Focused — Optimized casual with synergy",
  3: "Powerful — Strong combos & high interaction",
  4: "Competitive — cEDH & tournament level",
};

/**
 * Displays the MTG Commander bracket level (1-4).
 * Higher brackets are visually indicated with filled segments.
 */
export function BracketIndicator({ bracket, size = "md", className }: BracketIndicatorProps) {
  const sizeClasses = {
    sm: "gap-0.5",
    md: "gap-1",
  };

  const segmentSizeClasses = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center",
        sizeClasses[size],
        className
      )}
      title={bracketDescriptions[bracket]}
      aria-label={`Bracket ${bracket}: ${bracketDescriptions[bracket]}`}
    >
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className={cn(
            "rounded-sm transition-colors",
            segmentSizeClasses[size],
            level <= bracket
              ? "bg-accent"
              : "bg-card-border"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Displays bracket as a compact numeric badge.
 * Alternative to the segmented indicator when space is tight.
 */
export function BracketBadge({ bracket, className }: Omit<BracketIndicatorProps, "size">) {
  return (
    <span
      className={cn(
        "text-mono-xs inline-flex items-center justify-center",
        "h-5 min-w-5 px-1 rounded-sm",
        "bg-bg-overlay text-text-2 border border-card-border",
        className
      )}
      title={bracketDescriptions[bracket]}
    >
      B{bracket}
    </span>
  );
}
