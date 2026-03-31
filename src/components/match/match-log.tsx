"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MatchPreviewCard } from "./match-preview-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonMatchCard } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { MatchCardData } from "@/types";
import type { FormatSlug } from "@/types/format";

// ============================================
// Date Grouping Utilities
// ============================================

type DateGroup = "today" | "yesterday" | "this-week" | "this-month" | "older";

const DATE_GROUP_LABELS: Record<DateGroup, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  "this-month": "This Month",
  older: "Older",
};

function getDateGroup(dateString: string): DateGroup {
  const date = new Date(dateString);
  const now = new Date();
  
  // Reset time parts for accurate day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.floor((today.getTime() - matchDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "this-week";
  if (diffDays < 30) return "this-month";
  return "older";
}

function groupMatchesByDate(matches: MatchCardData[]): Map<DateGroup, MatchCardData[]> {
  const groups = new Map<DateGroup, MatchCardData[]>();
  
  for (const match of matches) {
    const group = getDateGroup(match.playedAt);
    const existing = groups.get(group) || [];
    groups.set(group, [...existing, match]);
  }
  
  return groups;
}

// ============================================
// Icons
// ============================================

function MatchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

// ============================================
// Filter Types & Components
// ============================================

type ResultFilter = "all" | "wins" | "losses";

type MatchFilters = {
  format: FormatSlug | "all";
  result: ResultFilter;
};

const FORMAT_OPTIONS: { value: FormatSlug | "all"; label: string }[] = [
  { value: "all", label: "All Formats" },
  { value: "ffa", label: "FFA" },
  { value: "1v1", label: "1v1" },
  { value: "2v2", label: "2v2" },
  { value: "3v3", label: "3v3" },
  { value: "pentagram", label: "Pentagram" },
];

const RESULT_OPTIONS: { value: ResultFilter; label: string }[] = [
  { value: "all", label: "All Results" },
  { value: "wins", label: "Wins" },
  { value: "losses", label: "Losses" },
];

type MatchLogFiltersProps = {
  filters: MatchFilters;
  onFiltersChange: (filters: MatchFilters) => void;
  className?: string;
};

function MatchLogFilters({
  filters,
  onFiltersChange,
  className,
}: MatchLogFiltersProps) {
  return (
    <div className={cn("flex flex-wrap gap-2 mb-4", className)}>
      {/* Format Filter */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {FORMAT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={filters.format === option.value ? "primary" : "ghost"}
            size="sm"
            onClick={() =>
              onFiltersChange({ ...filters, format: option.value })
            }
            className={cn(
              "text-xs px-2.5 py-1 h-auto",
              filters.format === option.value
                ? ""
                : "text-text-2 hover:text-text-1"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* Result Filter */}
      <div className="flex gap-1 bg-surface rounded-lg p-1">
        {RESULT_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={filters.result === option.value ? "primary" : "ghost"}
            size="sm"
            onClick={() =>
              onFiltersChange({ ...filters, result: option.value })
            }
            className={cn(
              "text-xs px-2.5 py-1 h-auto",
              filters.result === option.value
                ? ""
                : "text-text-2 hover:text-text-1"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function applyFilters(
  matches: MatchCardData[],
  filters: MatchFilters,
  currentUserId?: string
): MatchCardData[] {
  return matches.filter((match) => {
    // Format filter
    if (filters.format !== "all" && match.formatSlug !== filters.format) {
      return false;
    }

    // Result filter (requires knowing the current user)
    if (filters.result !== "all" && currentUserId) {
      // Check if current user is the winner via userParticipant
      const userParticipant = match.userParticipant;
      if (userParticipant) {
        const isWin = userParticipant.isWinner;
        if (filters.result === "wins" && !isWin) return false;
        if (filters.result === "losses" && isWin) return false;
      }
    }

    return true;
  });
}

// ============================================
// Component Types
// ============================================

type MatchLogProps = {
  /** Array of matches to display */
  matches: MatchCardData[];
  /** Whether to show ELO deltas on match cards */
  showElo?: boolean;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Number of skeleton cards to show when loading */
  skeletonCount?: number;
  /** Whether to group matches by date */
  groupByDate?: boolean;
  /** Custom empty state title */
  emptyTitle?: string;
  /** Custom empty state description */
  emptyDescription?: string;
  /** Custom empty state action */
  emptyAction?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Header title (optional) */
  title?: string;
  /** Header action (optional) */
  headerAction?: React.ReactNode;
  /** Whether to show filter controls */
  showFilters?: boolean;
  /** Current user ID for result filtering (wins/losses) */
  currentUserId?: string;
};

// ============================================
// Sub-components
// ============================================

function MatchLogHeader({
  title,
  matchCount,
  action,
}: {
  title: string;
  matchCount: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-display font-semibold text-text-1">
          {title}
        </h2>
        <span className="text-sm text-text-3 bg-surface px-2 py-0.5 rounded-full">
          {matchCount}
        </span>
      </div>
      {action}
    </div>
  );
}

function DateGroupHeader({ group }: { group: DateGroup }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <span className="text-sm font-medium text-text-2">
        {DATE_GROUP_LABELS[group]}
      </span>
      <div className="flex-1 h-px bg-card-border" />
    </div>
  );
}

function MatchLogSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMatchCard key={i} />
      ))}
    </div>
  );
}

function MatchLogEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <EmptyState
      icon={<MatchIcon className="w-full h-full" />}
      title={title}
      description={description}
      action={action}
      size="md"
      className="border border-card-border rounded-lg bg-card"
    />
  );
}

// ============================================
// Main Component
// ============================================

/**
 * Reusable match history log component.
 * 
 * Displays a list of matches using MatchPreviewCard, with support for:
 * - Date grouping (today, yesterday, this week, etc.)
 * - Loading skeleton state
 * - Empty state with customizable messaging
 * - Optional ELO display for personal history views
 * - Optional format and result filters
 * 
 * @example
 * ```tsx
 * // Player match history with filters
 * <MatchLog
 *   matches={playerMatches}
 *   showElo
 *   showFilters
 *   currentUserId={userId}
 *   groupByDate
 *   title="Match History"
 * />
 * 
 * // Collection match history (no filters)
 * <MatchLog
 *   matches={collectionMatches}
 *   emptyTitle="No matches in this collection"
 *   emptyDescription="Matches added to this collection will appear here"
 * />
 * ```
 */
export function MatchLog({
  matches,
  showElo = false,
  isLoading = false,
  skeletonCount = 5,
  groupByDate = true,
  emptyTitle = "No matches yet",
  emptyDescription = "Your match history will appear here",
  emptyAction,
  className,
  title,
  headerAction,
  showFilters = false,
  currentUserId,
}: MatchLogProps) {
  const [filters, setFilters] = React.useState<MatchFilters>({
    format: "all",
    result: "all",
  });

  // Apply filters to matches
  const filteredMatches = showFilters
    ? applyFilters(matches, filters, currentUserId)
    : matches;

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        {title && (
          <MatchLogHeader title={title} matchCount={0} action={headerAction} />
        )}
        {showFilters && (
          <MatchLogFilters filters={filters} onFiltersChange={setFilters} />
        )}
        <MatchLogSkeleton count={skeletonCount} />
      </div>
    );
  }

  // Empty state (check original matches, not filtered)
  if (matches.length === 0) {
    return (
      <div className={className}>
        {title && (
          <MatchLogHeader title={title} matchCount={0} action={headerAction} />
        )}
        <MatchLogEmpty
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  // No matches after filtering
  const hasActiveFilters = filters.format !== "all" || filters.result !== "all";
  if (filteredMatches.length === 0 && hasActiveFilters) {
    return (
      <div className={className}>
        {title && (
          <MatchLogHeader
            title={title}
            matchCount={matches.length}
            action={headerAction}
          />
        )}
        {showFilters && (
          <MatchLogFilters filters={filters} onFiltersChange={setFilters} />
        )}
        <MatchLogEmpty
          title="No matches found"
          description="Try adjusting your filters"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters({ format: "all", result: "all" })}
            >
              Clear filters
            </Button>
          }
        />
      </div>
    );
  }

  // Group matches by date if enabled
  const groupedMatches = groupByDate
    ? groupMatchesByDate(filteredMatches)
    : null;

  // Define the order of date groups
  const groupOrder: DateGroup[] = ["today", "yesterday", "this-week", "this-month", "older"];

  return (
    <div className={cn("", className)}>
      {title && (
        <MatchLogHeader
          title={title}
          matchCount={filteredMatches.length}
          action={headerAction}
        />
      )}

      {showFilters && (
        <MatchLogFilters filters={filters} onFiltersChange={setFilters} />
      )}

      {groupByDate && groupedMatches ? (
        // Grouped display
        <div className="flex flex-col gap-3">
          {groupOrder.map((group) => {
            const groupMatches = groupedMatches.get(group);
            if (!groupMatches || groupMatches.length === 0) return null;

            return (
              <div key={group}>
                <DateGroupHeader group={group} />
                <div className="flex flex-col gap-3">
                  {groupMatches.map((match) => (
                    <MatchPreviewCard
                      key={match.id}
                      match={match}
                      showElo={showElo}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Flat list display
        <div className="flex flex-col gap-3">
          {filteredMatches.map((match) => (
            <MatchPreviewCard
              key={match.id}
              match={match}
              showElo={showElo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { MatchLogFilters, type MatchFilters, type ResultFilter };
