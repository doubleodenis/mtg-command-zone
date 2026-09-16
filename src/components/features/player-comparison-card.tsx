"use client";

import { Swords, Handshake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorIdentity } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { ProfileSummary, PlayerStats } from "@/types";

type RelationshipRecord = {
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
};

type FormatVsRecord = {
  formatSlug: string;
  formatName: string;
  wins: number;
  losses: number;
  matchesPlayed: number;
  winRate: number;
};

type RivalryStreak = { count: number; result: "W" | "L" };

type RatingGapTrend = { current: number; past: number; daysSpan: number };

type Meeting = {
  matchId: string;
  playedAt: string;
  formatSlug: string;
  formatName: string;
  isWin: boolean;
  yourRating: number;
  opponentRating: number;
};

type ComparisonData = {
  you: ProfileSummary & { stats: PlayerStats; rating: number };
  opponent: ProfileSummary & { stats: PlayerStats; rating: number };
  asEnemies: RelationshipRecord;
  asTeammates: RelationshipRecord;
  byFormat: FormatVsRecord[];
  firstMetAt: string | null;
  mostRecentMatchAt: string | null;
  currentStreak: RivalryStreak | null;
  meetings: Meeting[];
  ratingGapTrend: RatingGapTrend | null;
};

type PlayerComparisonCardProps = {
  data: ComparisonData;
  className?: string;
};

/**
 * Displays comprehensive comparison stats between two players.
 * Shows win rates as enemies, teammates, by format, and best commander.
 */
export function PlayerComparisonCard({
  data,
  className,
}: PlayerComparisonCardProps) {
  const { opponent, asEnemies, asTeammates, byFormat, bestCommander } = data;

  const totalMatchesTogether =
    asEnemies.matchesPlayed + asTeammates.matchesPlayed;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            You vs {opponent.username}
          </CardTitle>
          <span className="text-sm text-text-2">
            {totalMatchesTogether} matches together
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Relationship Records - Enemies & Teammates */}
        <div className="grid grid-cols-2 gap-4">
          <RelationshipCard
            title="As Enemies"
            icon={<Swords className="w-5 h-5" />}
            record={asEnemies}
          />
          <RelationshipCard
            title="As Teammates"
            icon={<Handshake className="w-5 h-5" />}
            record={asTeammates}
          />
        </div>

        {/* Format Breakdown */}
        {byFormat.length > 0 && (
          <div>
            <h4 className="text-label text-text-2 mb-3">Win Rate by Format</h4>
            <div className="space-y-2">
              {byFormat.map((format) => (
                <FormatVsRow key={format.formatSlug} format={format} />
              ))}
            </div>
          </div>
        )}

        {/* Best Commander Against Them */}
        {bestCommander && (
          <div>
            <h4 className="text-label text-text-2 mb-3">
              Best Commander vs {opponent.username}
            </h4>
            <BestCommanderCard commander={bestCommander} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type RelationshipCardProps = {
  title: string;
  icon: React.ReactNode;
  record: RelationshipRecord;
};

function RelationshipCard({ title, icon, record }: RelationshipCardProps) {
  const winRateColor =
    record.winRate >= 50
      ? "text-win"
      : record.winRate < 40
      ? "text-loss"
      : "text-text-1";

  return (
    <div className="bg-surface rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-accent">{icon}</span>
        <span className="text-sm font-medium text-text-1">{title}</span>
      </div>

      {record.matchesPlayed > 0 ? (
        <>
          {/* Win Rate */}
          <div className="mb-2">
            <span
              className={cn("font-display text-2xl font-bold", winRateColor)}
            >
              {record.winRate}%
            </span>
            <span className="text-sm text-text-2 ml-1">win rate</span>
          </div>

          {/* W-L Record */}
          <div className="text-sm text-text-2">
            <span className="text-win font-medium">{record.wins}W</span>
            <span className="mx-1">-</span>
            <span className="text-loss font-medium">{record.losses}L</span>
            <span className="ml-2 text-text-3">
              ({record.matchesPlayed} matches)
            </span>
          </div>
        </>
      ) : (
        <p className="text-sm text-text-3">No matches yet</p>
      )}
    </div>
  );
}

export type {
  ComparisonData,
  RelationshipRecord,
  FormatVsRecord,
  RivalryStreak,
  RatingGapTrend,
  Meeting,
};
