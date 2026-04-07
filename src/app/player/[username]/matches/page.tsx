import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchLog } from "@/components/match";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername } from "@/lib/supabase";
import { getRecentMatchCards } from "@/lib/services";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function PlayerMatchHistoryPage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Get current user for claim display
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Get the profile being viewed
  const profileResult = await getProfileByUsername(supabase, username);
  
  if (!profileResult.success) {
    notFound();
  }
  
  const profile = profileResult.data;
  const isOwnProfile = currentUser?.id === profile.id;

  // Fetch matches for this user
  const matchesResult = await getRecentMatchCards(supabase, {
    userId: profile.id,
    limit: 100, // Show more matches on dedicated page
  });

  const matches = matchesResult.success ? matchesResult.data : [];

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
        showElo={isOwnProfile}
        showClaimBadges={!isOwnProfile && !!currentUser}
        showFilters
        currentUserId={profile.id}
        viewingUserId={currentUser?.id}
        groupByDate
        title="Match History"
        emptyTitle="No matches yet"
        emptyDescription={`${username} hasn't played any matches yet.`}
      />
    </div>
  );
}
