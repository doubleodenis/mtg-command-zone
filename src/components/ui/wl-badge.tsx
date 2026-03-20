import { cn } from "@/lib/utils";

interface WLBadgeProps {
  result: "win" | "loss";
  className?: string;
}

/**
 * Win/Loss result badge.
 * Compact 26x26px badge showing W or L with semantic coloring.
 */
export function WLBadge({ result, className }: WLBadgeProps) {
  const isWin = result === "win";

  return (
    <div
      className={cn(
        "text-ui flex items-center justify-center",
        "w-wl-badge h-wl-badge rounded-sm",
        "font-semibold",
        isWin
          ? "bg-win-subtle border border-win-ring text-win"
          : "bg-loss-subtle border border-loss-ring text-loss",
        className
      )}
    >
      {isWin ? "W" : "L"}
    </div>
  );
}
