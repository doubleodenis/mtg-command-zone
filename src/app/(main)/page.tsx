import Link from "next/link";
// import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/layout";
import { MatchPreviewCard } from "@/components/match/match-preview-card";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
import { LeaderboardPreview } from "@/components/features/leaderboard-preview";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import { PendingConfirmationCard } from "@/components/features/pending-confirmation-card";
import { CollectionActivityCard } from "@/components/features/collection-activity-card";
import { RatingHistoryChart } from "@/components/features/rating-history-chart";
import {
  createMockLeaderboard,
  createMockDeckWithStats,
  createMockDashboardMatches,
  createMockPlayerStats,
  createMockUserMatches,
  createMockPendingConfirmations,
  createMockCollectionActivities,
  createMockRatingTimeline,
} from "@/lib/mock";

export default async function HomePage() {
  // TODO: Re-enable Supabase auth when backend is configured
  // const supabase = await createClient();
  // const { data: { user } } = await supabase.auth.getUser();
  
  // Mock logged-in user for development
  const user = { id: 'mock-user-123' } as { id: string } | null;

  if (user) {
    return <PersonalDashboard userId={user.id} />;
  }

  return <GlobalDashboard />;
}

// ============================================
// Global Dashboard (Logged Out)
// ============================================

// Platform stats (mock counts)
const platformStats = {
  totalMatches: 12847,
  activePlayers: 3421,
  commandersPlayed: 892,
  collections: 156,
};

function GlobalDashboard() {
  // Generate mock data on each render
  const mockLeaderboard = createMockLeaderboard(5);
  const mockRecentMatches = createMockDashboardMatches();
  const mockTopCommanders = Array.from({ length: 5 }, (_, i) =>
    createMockDeckWithStats({ id: `deck-${i}` })
  );
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
          <DashboardStatCard label="Active Players" value={platformStats.activePlayers.toLocaleString()} />
          <DashboardStatCard label="Commanders Played" value={platformStats.commandersPlayed.toLocaleString()} />
          <DashboardStatCard label="Collections" value={platformStats.collections.toLocaleString()} />
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
            <LeaderboardPreview entries={mockLeaderboard} />
          </CardContent>
        </Card>
      </Section>

      {/* Recent Matches */}
      <Section title="RECENT MATCHES" action={
        <Link href="/matches" className="text-sm text-accent hover:text-accent-fill transition-colors">
          View All
        </Link>
      }>
        <div className="space-y-3">
          {mockRecentMatches.map((match) => (
            <MatchPreviewCard key={match.id} match={match} />
          ))}
        </div>
      </Section>

      {/* Most Played Commanders */}
      <Section title="POPULAR COMMANDERS">
        <Card>
          <CardContent className="p-0">
            <TopCommandersList commanders={mockTopCommanders} />
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
  // TODO: Re-enable Supabase when backend is configured
  // const supabase = await createClient();
  // const { data: profile } = await supabase
  //   .from("profiles")
  //   .select("username, display_name")
  //   .eq("id", userId)
  //   .single() as { data: { username: string; display_name: string | null } | null };
  // const displayName = profile?.display_name ?? profile?.username ?? "Commander";
  const displayName = "arcane_mage";

  // Generate mock data for development
  const stats = createMockPlayerStats({ totalMatches: 47, wins: 21 });
  const recentMatches = createMockUserMatches(userId);
  const pendingConfirmations = createMockPendingConfirmations(2);
  const collectionActivities = createMockCollectionActivities(3);
  const ratingHistory = createMockRatingTimeline(20, 1100);

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
          <DashboardStatCard label="Rating" value="1,247" sublabel="FFA" />
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
