import { cn } from "@/lib/utils";
import type { FormatSlug } from "@/types/format";

interface FormatBadgeProps {
  format: FormatSlug;
  className?: string;
}

const formatLabels: Record<FormatSlug, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  ffa: "FFA",
  pentagram: "Pentagram",
};

const formatDescriptions: Record<FormatSlug, string> = {
  "1v1": "Duel",
  "2v2": "Two-Headed Giant",
  "3v3": "Three vs Three",
  ffa: "Free For All",
  pentagram: "Star",
};

/**
 * Displays a format identifier badge.
 * Uses accent styling to stand out as a categorical indicator.
 */
export function FormatBadge({ format, className }: FormatBadgeProps) {
  return (
    <span
      className={cn(
        "text-ui inline-flex items-center rounded-md px-2 py-0.5",
        "bg-accent-dim text-accent border border-accent-ring",
        "text-sm font-medium",
        className
      )}
      title={formatDescriptions[format]}
    >
      {formatLabels[format]}
    </span>
  );
}
