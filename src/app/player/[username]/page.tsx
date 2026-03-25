import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, ColorIdentity } from "@/components/ui";
import { Section } from "@/components/layout";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
import { RatingHistoryChart } from "@/components/features/rating-history-chart";
import { ColorRadarChart } from "@/components/features/color-radar-chart";
import { MatchPreviewCard } from "@/components/match/match-preview-card";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import {
  createMockProfile,
  createMockPlayerStats,
  createMockColorStats,
  createMockFormatStats,
  createMockDeckWithStats,
  createMockUserMatches,
  createMockRatingTimeline,
  resetMockIds,
} from "@/lib/mock";
import type { FormatStatEntry } from "@/lib/mock";

// Force dynamic rendering to refresh mock data
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { username } = await params;

  // Reset mock IDs for fresh data
  resetMockIds();

  // Generate mock data for this profile
  const profile = createMockProfile({ username });
  const stats = createMockPlayerStats({ totalMatches: 87, wins: 39 });
  const colorStats = createMockColorStats();
  const formatStats = createMockFormatStats();
  const topCommanders = Array.from({ length: 5 }, (_, i) =>
    createMockDeckWithStats({ id: `commander-${i}` })
  );
  const recentMatches = createMockUserMatches(profile.id);
  const ratingHistory = createMockRatingTimeline(20, 1150);

  // Calculate overall rating (mock - average of format ratings)
  const overallRating = Math.round(
    formatStats.reduce((sum, f) => sum + f.rating, 0) / formatStats.length
  );

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <ProfileHeader
        profile={profile}
      />

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
            <RatingHistoryChart data={ratingHistory} height={200} />
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
              {recentMatches.slice(0, 5).map((match) => (
                <MatchPreviewCard key={match.id} match={match} showElo />
              ))}
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
                <FormatStatsList formatStats={formatStats} />
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
