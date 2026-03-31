import Link from "next/link";
import { MatchLog } from "@/components/match";
import { Section } from "@/components/layout";
import {
  createMockProfile,
  createMockUserMatches,
  resetMockIds,
} from "@/lib/mock";

// Force dynamic rendering to refresh mock data
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function PlayerMatchHistoryPage({ params }: PageProps) {
  const { username } = await params;

  // Reset mock IDs for fresh data
  resetMockIds();

  // Generate mock data
  const profile = createMockProfile({ username });
  const matches = createMockUserMatches(profile.id); // Full match history

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-2">
        <Link
          href={`/player/${username}`}
          className="hover:text-accent transition-colors"
        >
          {username}
        </Link>
        <span>/</span>
        <span className="text-text-1">Match History</span>
      </div>

      {/* Match History with Filters */}
      <MatchLog
        matches={matches}
        showElo
        showFilters
        currentUserId={profile.id}
        groupByDate
        title="Match History"
        emptyTitle="No matches yet"
        emptyDescription={`${username} hasn't played any matches yet.`}
      />
    </div>
  );
}
