import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/layout";
import { MatchPreviewCard } from "@/components/match/match-preview-card";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
// HIDDEN: Global leaderboards disabled - uncomment to re-enable
// import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import { PendingConfirmationCard } from "@/components/features/pending-confirmation-card";
import { CollectionActivityCard } from "@/components/features/collection-activity-card";
// HIDDEN: Rating system disabled - uncomment to re-enable
// import { RatingHistoryChart } from "@/components/features/rating-history-chart";
import { NavbarSearch } from "@/components/features/navbar-search";
// Raw database queries
import {
  getProfileById,
  getUserStats,
  getActiveDecks,
} from "@/lib/supabase";
// Business logic / data transformations
import {
  getPlatformStats,
  getRecentMatchCards,
  getUserPendingConfirmations,
  getUserCollectionActivities,
  getTopCommanders,
} from "@/lib/services";


// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <PersonalDashboard userId={user.id} />;
  }

  return <GlobalDashboard />;
}

// ============================================
// Global Dashboard (Logged Out)
// ============================================

async function GlobalDashboard() {
  const supabase = await createClient();

  // Fetch real data, with mock fallbacks
  const [platformStatsResult, 
    // formatsResult, 
    recentMatchesResult, 
    topCommandersResult] = await Promise.all([
    getPlatformStats(supabase),
    // getFormats(supabase),
    getRecentMatchCards(supabase, { limit: 5 }),
    getTopCommanders(supabase, { limit: 5 }),
  ]);

  // HIDDEN: Global leaderboards disabled - uncomment to re-enable
  // const formats = formatsResult.success ? formatsResult.data : [];
  // const leaderboardPromises = formats.map((f) => 
  //   getLeaderboard(supabase, f.id, 20).then(result => ({ format: f, result }))
  // );
  // const leaderboardResults = await Promise.all(leaderboardPromises);
  // const allEntries: LeaderboardEntry[] = [];
  // for (const { format, result } of leaderboardResults) {
  //   if (!result.success) continue;
  //   for (const entry of result.data) {
  //     allEntries.push({ ...entry, formatSlug: format.slug });
  //   }
  // }
  // const userMap = new Map<string, LeaderboardEntry>();
  // for (const entry of allEntries) {
  //   const existing = userMap.get(entry.id);
  //   if (existing) {
  //     existing.matchesPlayed += entry.matchesPlayed;
  //     existing.wins += entry.wins;
  //     existing.rating = Math.max(existing.rating, entry.rating);
  //     existing.winRate = existing.matchesPlayed > 0
  //       ? Math.round((existing.wins / existing.matchesPlayed) * 100)
  //       : 0;
  //   } else {
  //     userMap.set(entry.id, { ...entry, formatSlug: undefined });
  //   }
  // }
  // const aggregatedEntries = Array.from(userMap.values())
  //   .sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.rating - a.rating)
  //   .slice(0, 5)
  //   .map((entry, index) => ({ ...entry, rank: index + 1 }));
  // const leaderboard = [...aggregatedEntries, ...allEntries];

  // Use real data with empty state fallbacks
  const platformStats = platformStatsResult.success 
    ? platformStatsResult.data 
    : { totalMatches: 0, totalPlayers: 0, totalDecks: 0, totalCollections: 0 };

  const recentMatches = recentMatchesResult.success 
    ? recentMatchesResult.data 
    : [];

  const topCommanders = topCommandersResult.success
    ? topCommandersResult.data 
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome to CommandZone"
        description="Track your Commander matches, build your collection, and play with friends"
        actions={
          <Button asChild>
            <Link href="/login?mode=signup">Get Started</Link>
          </Button>
        }
      />

      {/* Mobile search bar */}
      <div className="md:hidden">
        <NavbarSearch />
      </div>

      {/* Platform Stats */}
      <Section title="PLATFORM STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardStatCard label="Total Matches" value={platformStats.totalMatches.toLocaleString()} />
          <DashboardStatCard label="Players" value={platformStats.totalPlayers.toLocaleString()} />
          <DashboardStatCard label="Decks" value={platformStats.totalDecks.toLocaleString()} />
          <DashboardStatCard label="Collections" value={platformStats.totalCollections.toLocaleString()} />
        </div>
      </Section>

      {/* HIDDEN: Global leaderboards disabled - uncomment to re-enable
      <Section title="TOP PLAYERS" action={
        <Link href="/leaderboards" className="text-sm text-accent hover:text-accent-fill transition-colors">
          View All
        </Link>
      }>
        <Card>
          <CardContent className="p-0">
            {leaderboard.length > 0 ? (
              <LeaderboardWithFilter entries={leaderboard} />
            ) : (
              <p className="text-text-2 text-center py-8">No rankings yet. Be the first to play!</p>
            )}
          </CardContent>
        </Card>
      </Section>
      */}

      {/* Recent Matches */}
      <Section title="RECENT MATCHES" action={
        <Link href="/matches" className="text-sm text-accent hover:text-accent-fill transition-colors">
          View All
        </Link>
      }>
        {recentMatches.length > 0 ? (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <MatchPreviewCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-text-2 text-center">No matches recorded yet.</p>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* Most Played Commanders */}
      <Section title="POPULAR COMMANDERS">
        <Card>
          <CardContent className="p-0">
            {topCommanders.length > 0 ? (
              <TopCommandersList commanders={topCommanders} />
            ) : (
              <p className="text-text-2 text-center py-8">No commanders played yet.</p>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* CTA */}
      <Card className="border-accent-ring bg-accent-dim/50">
        <CardContent className="p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-text-1 mb-2">
            Ready to track your games?
          </h2>
          <p className="text-text-2 mb-6">
            Sign up to record matches, build your collection, and play with friends.
          </p>
          <Button asChild size="lg">
            <Link href="/login?mode=signup">Create Account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Personal Dashboard (Logged In)
// ============================================

async function PersonalDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();

  // Fetch all data in parallel
  const [
    profileResult,
    statsResult,
    recentMatchesResult,
    pendingResult,
    collectionsResult,
    userDecksResult,
  ] = await Promise.all([
    getProfileById(supabase, userId),
    getUserStats(supabase, userId),
    getRecentMatchCards(supabase, { limit: 5, userId }),
    getUserPendingConfirmations(supabase, userId),
    getUserCollectionActivities(supabase, userId, 3),
    getActiveDecks(supabase, userId),
  ]);

  // Extract data with fallbacks
  const displayName = profileResult.success 
    ? profileResult.data.username 
    : 'Commander';

  const stats = statsResult.success 
    ? statsResult.data 
    : { totalMatches: 0, wins: 0, losses: 0, winRate: 0, currentStreak: 0, longestWinStreak: 0 };

  const recentMatches = recentMatchesResult.success 
    ? recentMatchesResult.data 
    : [];

  const pendingConfirmations = pendingResult.success 
    ? pendingResult.data 
    : [];

  const userDecks = userDecksResult.success
    ? userDecksResult.data.map(d => ({ id: d.id, deckName: d.deckName, commanderName: d.commanderName }))
    : [];

  const collectionActivities = collectionsResult.success 
    ? collectionsResult.data 
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${displayName}!`}
        description="Here's what's happening with your matches"
        actions={
          <Button asChild>
            <Link href="/matches/new">New Match</Link>
          </Button>
        }
      />

      {/* Mobile search bar */}
      <div className="md:hidden">
        <NavbarSearch />
      </div>

      {/* Quick Stats */}
      <Section title="YOUR STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* HIDDEN: Rating system disabled - uncomment to re-enable
          <DashboardStatCard label="Rating" value={primaryRating.toLocaleString()} sublabel={primaryFormatName} />
          */}
          <DashboardStatCard label="Win Rate" value={`${stats.winRate}%`} />
          <DashboardStatCard label="Matches" value={stats.totalMatches.toString()} />
          <DashboardStatCard label="Wins" value={stats.wins.toString()} />
          <DashboardStatCard label="Win Streak" value={stats.currentStreak.toString()} />
        </div>
      </Section>

      {/* HIDDEN: Rating system disabled - uncomment to re-enable
      <Section title="RATING HISTORY">
        <RatingHistoryChart data={ratingHistory} height={180} />
      </Section>
      */}

      {/* Collections Activity */}
      <Section 
        title="YOUR COLLECTIONS" 
        action={
          <Link href="/collections" className="text-sm text-accent hover:text-accent-fill transition-colors">
            View All
          </Link>
        }
      >
        {collectionActivities.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collectionActivities.map((activity) => (
              <CollectionActivityCard key={activity.collection.id} activity={activity} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-text-2 text-center py-4">
                Join or create a collection to see activity here.
              </p>
              <div className="flex justify-center">
                <Button variant="secondary" asChild>
                  <Link href="/collections">Browse Collections</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* Pending Confirmations */}
      <Section title="PENDING CONFIRMATIONS">
        {pendingConfirmations.length > 0 ? (
          <div className="space-y-3">
            {pendingConfirmations.map((confirmation) => (
              <PendingConfirmationCard 
                key={confirmation.participantId} 
                confirmation={confirmation}
                userDecks={userDecks}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-text-2 text-center py-4">
                No pending match confirmations.
              </p>
            </CardContent>
          </Card>
        )}
      </Section>

      {/* Claim Placeholder Prompt */}
      <Section>
        <Card className="border-accent-ring/50 bg-accent-dim/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-text-1 font-medium">
                  Were you added to matches before signing up?
                </p>
                <p className="text-xs text-text-2 mt-0.5">
                  Search for matches where you were listed as a placeholder participant
                </p>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/matches/claim">Search & Claim</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Recent Matches */}
      <Section 
        title="YOUR RECENT MATCHES" 
        action={
          <Link href="/matches" className="text-sm text-accent hover:text-accent-fill transition-colors">
            View All
          </Link>
        }
      >
        {recentMatches.length > 0 ? (
          <div className="space-y-4">
            {recentMatches.map((match) => (
              <MatchPreviewCard key={match.id} match={match} showElo />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-text-2 text-center py-4">
                You haven't recorded any matches yet.
              </p>
              <div className="flex justify-center">
                <Button variant="secondary" asChild>
                  <Link href="/matches/new">Record Your First Match</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Section>
    </div>
  );
}
