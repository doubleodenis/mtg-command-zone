import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { createClient } from "@/lib/supabase/server";
import {
  getCollectionById,
  isCollectionMember,
  getLeaderboard,
  getFormats,
} from "@/lib/supabase";
import type { LeaderboardEntry } from "@/types";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionLeaderboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch collection
  const collectionResult = await getCollectionById(supabase, id);
  
  if (!collectionResult.success) {
    notFound();
  }

  const collection = collectionResult.data;

  // Check membership
  let isMember = false;
  if (user) {
    const memberResult = await isCollectionMember(supabase, id, user.id);
    isMember = memberResult.success && memberResult.data === true;
  }

  // If collection is private and user is not a member, return 404
  if (!collection.isPublic && !isMember) {
    notFound();
  }

  // Fetch leaderboards for all formats
  const formatsResult = await getFormats(supabase);
  const formats = formatsResult.success ? formatsResult.data : [];
  const leaderboardPromises = formats.map((f) => 
    getLeaderboard(supabase, f.id, 100, id).then(result => ({ format: f, result }))
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
      // Combine stats - keep highest rating, sum matches/wins
      existing.matchesPlayed += entry.matchesPlayed;
      existing.wins += entry.wins;
      existing.rating = Math.max(existing.rating, entry.rating);
      existing.winRate = existing.matchesPlayed > 0
        ? Math.round((existing.wins / existing.matchesPlayed) * 100)
        : 0;
    } else {
      // "all" entries have no formatSlug
      userMap.set(entry.id, { ...entry, formatSlug: undefined });
    }
  }

  // Build aggregated entries
  const aggregatedEntries = Array.from(userMap.values())
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  // Combine: aggregated (for "All") + individual format entries (for filtering)
  const leaderboard = [...aggregatedEntries, ...allEntries];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="Rankings based on matches within this collection"
      />

      <Card>
        <CardContent className="p-0">
          <LeaderboardWithFilter entries={leaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}
