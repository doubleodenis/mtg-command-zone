import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/layout";
import { MatchPreviewCard } from "@/components/match/match-preview-card";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import { PendingConfirmationCard } from "@/components/features/pending-confirmation-card";
import { CollectionActivityCard } from "@/components/features/collection-activity-card";
import { RatingHistoryChart } from "@/components/features/rating-history-chart";
// Raw database queries
import {
  getLeaderboard,
  getProfileById,
  getUserStats,
  getUserRatings,
  getRatingHistory,
  getFormats,
} from "@/lib/supabase";
// Business logic / data transformations
import {
  getPlatformStats,
  getRecentMatchCards,
  getUserPendingConfirmations,
  getUserCollectionActivities,
  getTopCommanders,
} from "@/lib/services";
import type { RatingHistoryEntry } from "@/types";
import {
  createMockPlayerStats,
  createMockUserMatches,
  createMockRatingTimeline,
} from "@/lib/mock";

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
  const [platformStatsResult, formatsResult, recentMatchesResult, topCommandersResult] = await Promise.all([
    getPlatformStats(supabase),
    getFormats(supabase),
    getRecentMatchCards(supabase, { limit: 5 }),
    getTopCommanders(supabase, { limit: 5 }),
  ]);

  // Get leaderboard for first format (FFA typically)
  const ffaFormat = formatsResult.success 
    ? formatsResult.data.find(f => f.slug === 'ffa') 
    : null;
  
  const leaderboardResult = ffaFormat 
    ? await getLeaderboard(supabase, ffaFormat.id, 5)
    : { success: false as const, error: 'No format found' };

  // Use real data with empty state fallbacks
  const platformStats = platformStatsResult.success 
    ? platformStatsResult.data 
    : { totalMatches: 0, totalPlayers: 0, totalDecks: 0, totalCollections: 0 };

  const leaderboard = leaderboardResult.success 
    ? leaderboardResult.data 
    : [];

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
        description="Track your Commander matches, compete with friends, and climb the leaderboards"
        actions={
          <Button asChild>
            <Link href="/login">Get Started</Link>
          </Button>
        }
      />

      {/* Platform Stats */}
      <Section title="PLATFORM STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardStatCard label="Total Matches" value={platformStats.totalMatches.toLocaleString()} />
          <DashboardStatCard label="Players" value={platformStats.totalPlayers.toLocaleString()} />
          <DashboardStatCard label="Decks" value={platformStats.totalDecks.toLocaleString()} />
          <DashboardStatCard label="Collections" value={platformStats.totalCollections.toLocaleString()} />
        </div>
      </Section>

      {/* Leaderboards Preview */}
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
            Sign up to record matches, track your rating, and compete with friends.
          </p>
          <Button asChild size="lg">
            <Link href="/login">Create Account</Link>
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
    ratingsResult,
    recentMatchesResult,
    pendingResult,
    collectionsResult,
    ratingHistoryResult,
    formatsResult,
  ] = await Promise.all([
    getProfileById(supabase, userId),
    getUserStats(supabase, userId),
    getUserRatings(supabase, userId),
    getRecentMatchCards(supabase, { limit: 5, userId }),
    getUserPendingConfirmations(supabase, userId),
    getUserCollectionActivities(supabase, userId, 3),
    getRatingHistory(supabase, userId, { limit: 20 }),
    getFormats(supabase),
  ]);

  // Extract data with fallbacks
  const displayName = profileResult.success 
    ? profileResult.data.username 
    : 'Commander';

  const stats = statsResult.success 
    ? statsResult.data 
    : createMockPlayerStats({ totalMatches: 0, wins: 0 });

  // Get primary rating (FFA or first available)
  const ffaRating = ratingsResult.success 
    ? ratingsResult.data.find(r => r.formatSlug === 'ffa')
    : null;
  const primaryRating = ffaRating?.rating ?? 1000;
  const primaryFormatName = ffaRating?.formatName ?? 'FFA';

  const recentMatches = recentMatchesResult.success 
    ? recentMatchesResult.data 
    : createMockUserMatches(userId);

  const pendingConfirmations = pendingResult.success 
    ? pendingResult.data 
    : [];

  const collectionActivities = collectionsResult.success 
    ? collectionsResult.data 
    : [];

  // Transform RatingHistory to RatingHistoryEntry for the chart
  const ratingHistory: RatingHistoryEntry[] = ratingHistoryResult.success 
    ? ratingHistoryResult.data.map(entry => ({
        ...entry,
        matchDate: entry.createdAt,
        isWin: entry.delta > 0,
        opponentCount: 3, // Default, would need additional query for accurate count
      }))
    : createMockRatingTimeline(20, 1100);

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

      {/* Quick Stats */}
      <Section title="YOUR STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardStatCard label="Rating" value={primaryRating.toLocaleString()} sublabel={primaryFormatName} />
          <DashboardStatCard label="Win Rate" value={`${stats.winRate}%`} />
          <DashboardStatCard label="Matches" value={stats.totalMatches.toString()} />
          <DashboardStatCard label="Win Streak" value={stats.currentStreak.toString()} />
        </div>
      </Section>

      {/* Rating History Chart */}
      <Section title="RATING HISTORY">
        <RatingHistoryChart data={ratingHistory} height={180} />
      </Section>

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
              <PendingConfirmationCard key={confirmation.participantId} confirmation={confirmation} />
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
