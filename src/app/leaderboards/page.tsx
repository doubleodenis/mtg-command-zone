import { redirect } from "next/navigation";

// HIDDEN: Global leaderboards are disabled
// To re-enable, restore the original page content from git history
export default function LeaderboardsPage() {
  redirect("/");
}

/* ORIGINAL CODE - HIDDEN
import { createClient } from "@/lib/supabase/server";
import { getFormats, getLeaderboard } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import type { LeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const supabase = await createClient();

  // Fetch all formats
  const formatsResult = await getFormats(supabase);
  if (!formatsResult.success) {
    throw new Error(formatsResult.error);
  }

  const formats = formatsResult.data;

  // Fetch leaderboards for all formats
  const leaderboardPromises = formats.map((f) =>
    getLeaderboard(supabase, f.id, 100).then((result) => ({ format: f, result }))
  );
  const leaderboardResults = await Promise.all(leaderboardPromises);

  // Build entries with format slugs for filtering
  const allEntries: LeaderboardEntry[] = [];
  for (const { format, result } of leaderboardResults) {
    if (!result.success) continue;
    for (const entry of result.data) {
      allEntries.push({ ...entry, formatSlug: format.slug });
    }
  }

  // Aggregate for "All Formats" view
  const userMap = new Map<string, LeaderboardEntry>();
  for (const entry of allEntries) {
    const existing = userMap.get(entry.id);
    if (existing) {
      existing.matchesPlayed += entry.matchesPlayed;
      existing.wins += entry.wins;
      existing.rating = Math.max(existing.rating, entry.rating);
      existing.winRate =
        existing.matchesPlayed > 0
          ? Math.round((existing.wins / existing.matchesPlayed) * 100)
          : 0;
    } else {
      userMap.set(entry.id, { ...entry, formatSlug: undefined });
    }
  }

  const aggregatedEntries = Array.from(userMap.values())
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  // Combine: aggregated (for "All") + individual format entries (for filtering)
  const leaderboard = [...aggregatedEntries, ...allEntries];

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Leaderboards"
        description="Top ranked players across all formats"
      />

      <Card className="mt-8">
        <CardContent className="p-0">
          <LeaderboardWithFilter entries={leaderboard} />
        </CardContent>
      </Card>
    </main>
  );
}
*/
