import type { SupabaseClient } from "@supabase/supabase-js";
import { getFormats, getLeaderboard } from "@/lib/supabase";
import type { LeaderboardEntry, FormatSlug } from "@/types";
import type { Result } from "@/types/common";

/**
 * Options for fetching leaderboard data
 */
export interface GetLeaderboardDataOptions {
  /** Limit per format (default: 100) */
  limitPerFormat?: number;
  /** Filter to a specific collection */
  collectionId?: string;
  /** Limit for aggregated entries (default: no limit) */
  aggregatedLimit?: number;
}

/**
 * Processed leaderboard data with aggregated and per-format entries
 */
export interface LeaderboardData {
  /** All entries combining aggregated and per-format */
  entries: LeaderboardEntry[];
  /** Just the aggregated "all formats" entries */
  aggregatedEntries: LeaderboardEntry[];
  /** Entries grouped by format slug */
  byFormat: Map<FormatSlug, LeaderboardEntry[]>;
}

/**
 * Aggregate leaderboard entries from multiple formats.
 * Combines stats: sums matches/wins, keeps max rating.
 */
export function aggregateLeaderboardEntries(
  allEntries: LeaderboardEntry[],
  options?: { limit?: number }
): LeaderboardEntry[] {
  const userMap = new Map<string, LeaderboardEntry>();

  for (const entry of allEntries) {
    const existing = userMap.get(entry.id);
    if (existing) {
      // Combine stats - keep highest rating, sum matches/wins
      existing.matchesPlayed += entry.matchesPlayed;
      existing.wins += entry.wins;
      existing.rating = Math.max(existing.rating, entry.rating);
      existing.winRate =
        existing.matchesPlayed > 0
          ? Math.round((existing.wins / existing.matchesPlayed) * 100)
          : 0;
    } else {
      // "all" entries have no formatSlug
      userMap.set(entry.id, { ...entry, formatSlug: undefined });
    }
  }

  let aggregated = Array.from(userMap.values()).sort(
    (a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating
  );

  if (options?.limit) {
    aggregated = aggregated.slice(0, options.limit);
  }

  // Assign ranks
  return aggregated.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * Fetch and process leaderboard data across all formats.
 * Returns combined data with aggregated totals and per-format breakdowns.
 *
 * @example
 * // Global leaderboard
 * const result = await getLeaderboardData(supabase);
 *
 * // Collection-scoped leaderboard
 * const result = await getLeaderboardData(supabase, { collectionId: 'abc' });
 */
export async function getLeaderboardData(
  supabase: SupabaseClient,
  options: GetLeaderboardDataOptions = {}
): Promise<Result<LeaderboardData>> {
  const { limitPerFormat = 100, collectionId, aggregatedLimit } = options;

  // Fetch all formats
  const formatsResult = await getFormats(supabase);
  if (!formatsResult.success) {
    return { success: false, error: formatsResult.error };
  }

  const formats = formatsResult.data;

  // Fetch leaderboards for all formats in parallel
  const leaderboardPromises = formats.map((f) =>
    getLeaderboard(supabase, f.id, limitPerFormat, collectionId).then((result) => ({
      format: f,
      result,
    }))
  );
  const leaderboardResults = await Promise.all(leaderboardPromises);

  // Build entries with format slugs for filtering
  const allEntries: LeaderboardEntry[] = [];
  const byFormat = new Map<FormatSlug, LeaderboardEntry[]>();

  for (const { format, result } of leaderboardResults) {
    if (!result.success) continue;

    const formatEntries: LeaderboardEntry[] = [];
    for (const entry of result.data) {
      const entryWithFormat = { ...entry, formatSlug: format.slug };
      allEntries.push(entryWithFormat);
      formatEntries.push(entryWithFormat);
    }
    byFormat.set(format.slug, formatEntries);
  }

  // Aggregate for "All Formats" view
  const aggregatedEntries = aggregateLeaderboardEntries(allEntries, {
    limit: aggregatedLimit,
  });

  // Combine: aggregated (for "All") + individual format entries (for filtering)
  const entries = [...aggregatedEntries, ...allEntries];

  return {
    success: true,
    data: {
      entries,
      aggregatedEntries,
      byFormat,
    },
  };
}

/**
 * Get leaderboard entries for a specific format.
 * Convenience wrapper around getLeaderboardData.
 */
export async function getLeaderboardByFormat(
  supabase: SupabaseClient,
  formatSlug: FormatSlug,
  options: { limit?: number; collectionId?: string } = {}
): Promise<Result<LeaderboardEntry[]>> {
  const result = await getLeaderboardData(supabase, {
    limitPerFormat: options.limit || 100,
    collectionId: options.collectionId,
  });

  if (!result.success) {
    return result;
  }

  const formatEntries = result.data.byFormat.get(formatSlug) || [];
  return { success: true, data: formatEntries };
}

/**
 * Find a specific player in the leaderboard by user ID.
 */
export function findPlayerInLeaderboard(
  entries: LeaderboardEntry[],
  userId: string
): LeaderboardEntry | undefined {
  return entries.find((e) => e.id === userId);
}

/**
 * Get top player by a specific metric.
 */
export function getTopPlayerBy(
  entries: LeaderboardEntry[],
  metric: "rating" | "winRate" | "matchesPlayed" | "wins"
): LeaderboardEntry | undefined {
  if (entries.length === 0) return undefined;

  return entries.reduce((best, entry) => {
    switch (metric) {
      case "rating":
        return entry.rating > best.rating ? entry : best;
      case "winRate":
        return entry.winRate > best.winRate ? entry : best;
      case "matchesPlayed":
        return entry.matchesPlayed > best.matchesPlayed ? entry : best;
      case "wins":
        return entry.wins > best.wins ? entry : best;
      default:
        return best;
    }
  }, entries[0]);
}
