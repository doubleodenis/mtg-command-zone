import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, ColorIdentity } from "@/components/ui";
import { Section } from "@/components/layout";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
import { RatingHistoryChart } from "@/components/features/rating-history-chart";
import { ColorRadarChart } from "@/components/features/color-radar-chart";
import { PlayerComparisonCard } from "@/components/features/player-comparison-card";
import { MatchPreviewCard } from "@/components/match/match-preview-card";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import { createClient } from "@/lib/supabase/server";
import {
  getProfileByUsername,
  getUserStats,
  getUserRatings,
  getFormatStats,
  getUserDecksWithStats,
} from "@/lib/supabase";
import {
  getRecentMatchCards,
} from "@/lib/services";
import {
  createMockPlayerComparison,
  createMockRatingTimeline,
} from "@/lib/mock";
import type { FormatStats } from "@/types/profile";

// Type for color stats used in radar chart
type ColorStats = {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
};

// Type for formatted format stats in the UI
type FormatStatEntry = {
  formatSlug: string;
  formatName: string;
  rating: number;
  matchesPlayed: number;
  winRate: number;
};

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  // Get the current logged-in user
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // Get the profile being viewed
  const profileResult = await getProfileByUsername(supabase, username);
  
  if (!profileResult.success) {
    notFound();
  }
  
  const profile = profileResult.data;
  const isOwnProfile = currentUser?.id === profile.id;

  // Fetch all user data in parallel
  const [statsResult, ratingsResult, formatStatsResult, recentMatchesResult, userDecksResult] = await Promise.all([
    getUserStats(supabase, profile.id),
    getUserRatings(supabase, profile.id),
    getFormatStats(supabase, profile.id),
    getRecentMatchCards(supabase, { userId: profile.id, limit: 5 }),
    getUserDecksWithStats(supabase, profile.id),
  ]);

  // Extract data with fallbacks
  const stats = statsResult.success ? statsResult.data : {
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    currentStreak: 0,
    longestWinStreak: 0,
  };
  
  const ratings = ratingsResult.success ? ratingsResult.data : [];
  const formatStats = formatStatsResult.success ? formatStatsResult.data : [];
  const recentMatches = recentMatchesResult.success ? recentMatchesResult.data : [];
  
  // Sort decks by games played to get top commanders
  const userDecks = userDecksResult.success ? userDecksResult.data : [];
  const topCommanders = [...userDecks]
    .sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed)
    .slice(0, 5);

  // Use mock rating timeline until we implement proper history tracking
  // TODO: Replace with real rating history once RatingHistoryEntry data is available
  const ratingTimeline = createMockRatingTimeline(20, ratings.length > 0 
    ? Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
    : 1000
  );

  // Calculate overall rating (average of format ratings or default)
  const overallRating = ratings.length > 0
    ? Math.round(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length)
    : 1000;

  // Generate comparison data only when viewing another user's profile
  // TODO: Replace with real head-to-head comparison when available
  const comparisonData = !isOwnProfile && currentUser
    ? createMockPlayerComparison(
        { id: profile.id, username: profile.username, avatarUrl: profile.avatarUrl },
        stats,
        overallRating
      )
    : null;

  // Calculate color stats from user's decks (weighted by games played)
  const colorStats: ColorStats = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const deck of userDecks) {
    const gamesPlayed = deck.stats.gamesPlayed;
    if (gamesPlayed > 0 && deck.colorIdentity) {
      for (const color of deck.colorIdentity) {
        if (color in colorStats) {
          colorStats[color as keyof ColorStats] += gamesPlayed;
        }
      }
    }
  }

  // Transform format stats to expected format
  const formattedFormatStats = formatStats.map((s) => ({
    formatSlug: s.formatName.toLowerCase().replace(/ /g, '-'),
    formatName: s.formatName,
    rating: ratings.find(r => r.formatId === s.formatId)?.rating ?? 1000,
    matchesPlayed: s.totalMatches,
    winRate: s.winRate,
  }));

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <ProfileHeader profile={profile} />

      {/* Head-to-Head Comparison (only when viewing someone else's profile) */}
      {comparisonData && (
        <Section title="COMPARED TO YOU">
          <PlayerComparisonCard data={comparisonData} />
        </Section>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DashboardStatCard
          label="Overall Rating"
          value={overallRating.toLocaleString()}
        />
        <DashboardStatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          sublabel={`${stats.wins}W - ${stats.losses}L`}
        />
        <DashboardStatCard
          label="Total Matches"
          value={stats.totalMatches.toString()}
        />
        <DashboardStatCard
          label="Best Streak"
          value={`${stats.longestWinStreak} wins`}
          sublabel={stats.currentStreak > 0 ? `🔥 Current: ${stats.currentStreak}` : undefined}
        />
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Charts & Stats */}
        <div className="lg:col-span-2 space-y-8">
          {/* Rating History */}
          <Section title="RATING HISTORY">
            <RatingHistoryChart data={ratingTimeline} height={200} />
          </Section>

          {/* Recent Matches */}
          <Section
            title="RECENT MATCHES"
            action={
              <Link
                href={`/player/${username}/matches`}
                className="text-sm text-accent hover:text-accent-fill transition-colors"
              >
                View All
              </Link>
            }
          >
            <div className="space-y-4">
              {recentMatches.length > 0 ? (
                recentMatches.map((match) => (
                  <MatchPreviewCard key={match.id} match={match} showElo />
                ))
              ) : (
                <p className="text-text-3 text-center py-8">No matches yet</p>
              )}
            </div>
          </Section>
        </div>

        {/* Right Column - Color Identity & Format Stats */}
        <div className="space-y-8">
          {/* Color Identity Radar */}
          <Section title="COLOR PROFILE">
            <Card>
              <CardContent className="p-4">
                <ColorRadarChart colorStats={colorStats} height={220} />
                <ColorBreakdown colorStats={colorStats} />
              </CardContent>
            </Card>
          </Section>

          {/* Format Performance */}
          <Section title="FORMAT STATS">
            <Card>
              <CardContent className="p-0">
                <FormatStatsList formatStats={formattedFormatStats} />
              </CardContent>
            </Card>
          </Section>

          {/* Top Commanders */}
          <Section title="TOP COMMANDERS">
            <Card>
              <CardContent className="p-0">
                <TopCommandersList commanders={topCommanders} />
              </CardContent>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function ProfileHeader({
  profile,
}: {
  profile: { username: string; avatarUrl: string | null };
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Avatar */}
      <Avatar
        src={profile.avatarUrl}
        fallback={profile.username}
        size="xl"
        className="ring-4 ring-accent/30"
      />

      {/* Info */}
      <div className="flex-1 text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-text-1 mb-1">
          {profile.username}
        </h1>
        <p className="text-sm text-text-2">@{profile.username}</p>
      </div>
    </div>
  );
}

function ColorBreakdown({
  colorStats,
}: {
  colorStats: { W: number; U: number; B: number; R: number; G: number };
}) {
  const total = Object.values(colorStats).reduce((a, b) => a + b, 0);
  const colors = [
    { key: "W", name: "White", games: colorStats.W },
    { key: "U", name: "Blue", games: colorStats.U },
    { key: "B", name: "Black", games: colorStats.B },
    { key: "R", name: "Red", games: colorStats.R },
    { key: "G", name: "Green", games: colorStats.G },
  ].sort((a, b) => b.games - a.games);

  return (
    <div className="mt-4 pt-4 border-t border-card-border space-y-2">
      {colors.slice(0, 3).map((color) => (
        <div key={color.key} className="flex items-center gap-3">
          <ColorIdentity
            colors={[color.key as "W" | "U" | "B" | "R" | "G"]}
            size="md"
          />
          <div className="flex-1">
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded-full"
                style={{ width: `${(color.games / total) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-text-2 w-16 text-right">
            {Math.round((color.games / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function FormatStatsList({
  formatStats,
}: {
  formatStats: FormatStatEntry[];
}) {
  return (
    <div className="divide-y divide-card-border">
      {formatStats.map((format) => (
        <div
          key={format.formatSlug}
          className="flex items-center justify-between px-4 py-3"
        >
          <div>
            <p className="font-medium text-text-1">{format.formatName}</p>
            <p className="text-mono-sm text-text-2">
              {format.matchesPlayed} matches
            </p>
          </div>
          <div className="text-right">
            <p className="font-display font-bold text-text-1">
              {format.rating.toLocaleString()}
            </p>
            <p className="text-sm text-text-2">{format.winRate}% WR</p>
          </div>
        </div>
      ))}
    </div>
  );
}
