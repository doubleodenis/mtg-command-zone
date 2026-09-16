"use client";

import { Swords, Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui";
import { RivalryMeetingsChart } from "@/components/features/rivalry-meetings-chart";
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
 * Displays a head-to-head comparison between two players: an identity
 * header, mirrored stat bars (rating, win rate, matches), a rivalry
 * meetings chart once enough shared history exists (or a sparse-history
 * unlock progress block otherwise), and format-performance chips.
 */
export function PlayerComparisonCard({
  data,
  className,
}: PlayerComparisonCardProps) {
  const { you, opponent, asEnemies, asTeammates, byFormat, currentStreak, meetings, ratingGapTrend } = data;

  const totalMatchesTogether = asEnemies.matchesPlayed + asTeammates.matchesPlayed;
  const chartUnlocked = totalMatchesTogether >= 3;

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Identity header */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center gap-3 p-4 sm:p-5 bg-gradient-to-b from-accent-dim to-transparent border-b sm:border-b-0 sm:border-r border-card-border">
          <Avatar src={you.avatarUrl} fallback={you.displayName || you.username} size="md" className="ring-2 ring-accent" />
          <div>
            <p className="font-display text-lg font-bold text-text-1">{you.displayName || "You"}</p>
            <p className="text-xs text-text-2 font-mono">@{you.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 sm:p-5 justify-start sm:justify-end bg-gradient-to-b from-gold-subtle to-transparent">
          <div className="sm:text-right sm:order-1">
            <p className="font-display text-lg font-bold text-text-1">{opponent.displayName || opponent.username}</p>
            <p className="text-xs text-text-2 font-mono">@{opponent.username}</p>
          </div>
          <Avatar src={opponent.avatarUrl} fallback={opponent.displayName || opponent.username} size="md" className="ring-2 ring-gold sm:order-2" />
        </div>
      </div>

      <CardContent className="space-y-6 pt-5">
        <MirroredStatBars you={you} opponent={opponent} />

        {chartUnlocked ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-label text-text-2">Rating Gap · Last {meetings.length} Meetings</h4>
              <span className="text-mono-xs text-text-2">
                <span className="text-accent">■</span> {you.username} &nbsp;
                <span className="text-gold">■</span> {opponent.username}
              </span>
            </div>
            <RivalryMeetingsChart meetings={meetings} youLabel={you.username} opponentLabel={opponent.username} />
            <RivalryStatTiles
              asEnemies={asEnemies}
              asTeammates={asTeammates}
              currentStreak={currentStreak}
              ratingGapTrend={ratingGapTrend}
            />
          </div>
        ) : (
          <SparseRivalryUnlock
            matchesTogether={totalMatchesTogether}
            meetings={meetings}
            opponentUsername={opponent.username}
          />
        )}

        {byFormat.length > 0 && (
          <div>
            <h4 className="text-label text-text-2 mb-3">Where You Beat Them</h4>
            <FormatBeatChips byFormat={byFormat} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type MirroredStatBarsProps = {
  you: { stats: PlayerStats; rating: number };
  opponent: { stats: PlayerStats; rating: number };
};

function MirroredStatBars({ you, opponent }: MirroredStatBarsProps) {
  const rows: { label: string; you: number; opponent: number; format?: (n: number) => string }[] = [
    { label: "Rating", you: you.rating, opponent: opponent.rating },
    { label: "Win Rate", you: you.stats.winRate, opponent: opponent.stats.winRate, format: (n) => `${n}%` },
    { label: "Matches", you: you.stats.totalMatches, opponent: opponent.stats.totalMatches },
  ];

  const maxByRow = rows.map((r) => Math.max(r.you, r.opponent, 1));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const format = row.format ?? ((n: number) => n.toLocaleString());
        const max = maxByRow[i];
        return (
          <div key={row.label} className="grid grid-cols-[1fr_110px_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-3">
              <span className="font-display text-xl font-bold text-text-1">{format(row.you)}</span>
              <div className="h-2 w-full max-w-[140px] bg-bg-overlay rounded-sm flex justify-end overflow-hidden">
                <div className="h-2 bg-accent rounded-sm" style={{ width: `${(row.you / max) * 100}%` }} />
              </div>
            </div>
            <span className="text-label text-text-2 text-center">{row.label}</span>
            <div className="flex items-center gap-3">
              <div className="h-2 w-full max-w-[140px] bg-bg-overlay rounded-sm overflow-hidden">
                <div className="h-2 bg-gold rounded-sm" style={{ width: `${(row.opponent / max) * 100}%` }} />
              </div>
              <span className="font-display text-xl font-bold text-text-1">{format(row.opponent)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type RivalryStatTilesProps = {
  asEnemies: RelationshipRecord;
  asTeammates: RelationshipRecord;
  currentStreak: RivalryStreak | null;
  ratingGapTrend: RatingGapTrend | null;
};

function RivalryStatTiles({ asEnemies, asTeammates, currentStreak, ratingGapTrend }: RivalryStatTilesProps) {
  const tileCount = 2 + (currentStreak ? 1 : 0) + (ratingGapTrend ? 1 : 0);

  return (
    <div className={cn("grid gap-3", tileCount === 4 ? "grid-cols-2 sm:grid-cols-4" : tileCount === 3 ? "grid-cols-3" : "grid-cols-2")}>
      <RelationshipCard title="As Enemies" icon={<Swords className="w-5 h-5" />} record={asEnemies} />
      <RelationshipCard title="As Teammates" icon={<Handshake className="w-5 h-5" />} record={asTeammates} />
      {currentStreak && (
        <div className="bg-surface rounded-lg p-4">
          <span className="text-label text-text-2 block mb-2">Current Streak</span>
          <span className={cn("font-display text-2xl font-bold", currentStreak.result === "W" ? "text-win" : "text-loss")}>
            {currentStreak.result}{currentStreak.count}
          </span>
        </div>
      )}
      {ratingGapTrend && (
        <div className="bg-surface rounded-lg p-4">
          <span className="text-label text-text-2 block mb-2">Gap Closing</span>
          <span className="font-display text-2xl font-bold text-text-1">{ratingGapTrend.current >= 0 ? "+" : ""}{ratingGapTrend.current}</span>
          <p className="text-xs text-win mt-1">
            {Math.abs(ratingGapTrend.current - ratingGapTrend.past)} in {ratingGapTrend.daysSpan} days
          </p>
        </div>
      )}
    </div>
  );
}

type FormatBeatChipsProps = {
  byFormat: FormatVsRecord[];
};

function FormatBeatChips({ byFormat }: FormatBeatChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {byFormat.map((format) => {
        const style =
          format.winRate > 50
            ? "border-win-ring bg-win-subtle text-win"
            : format.winRate < 50
            ? "border-loss-ring bg-loss-subtle text-loss"
            : "border-card-border bg-card-raised text-text-2";
        return (
          <div key={format.formatSlug} className={cn("flex items-baseline gap-2 rounded-md border px-3.5 py-2", style)}>
            <span className="font-display font-semibold text-sm text-text-1">{format.formatName}</span>
            <span className="text-mono-xs">
              {format.winRate}% · {format.wins}W {format.losses}L
            </span>
          </div>
        );
      })}
    </div>
  );
}

type SparseRivalryUnlockProps = {
  matchesTogether: number;
  meetings: Meeting[];
  opponentUsername: string;
};

function SparseRivalryUnlock({ matchesTogether, meetings, opponentUsername }: SparseRivalryUnlockProps) {
  const lastMeeting = meetings[meetings.length - 1];

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1 border border-dashed border-card-border rounded-lg bg-bg-raised flex flex-col items-center justify-center gap-3 min-h-[140px] p-6">
        <p className="font-display text-base font-semibold text-text-2">Rivalry chart unlocks at 3 matches</p>
        <div className="flex items-center gap-2">
          <div className="w-28 h-1.5 rounded-full bg-bg-overlay overflow-hidden">
            <div className="h-1.5 bg-accent rounded-full" style={{ width: `${(matchesTogether / 3) * 100}%` }} />
          </div>
          <span className="text-mono-xs text-text-3">{matchesTogether} / 3</span>
        </div>
      </div>
      {lastMeeting && (
        <div className="w-full sm:w-72 space-y-3">
          <h5 className="text-label text-text-2">
            {matchesTogether === 1 ? "Your One Meeting" : "Your Meetings So Far"}
          </h5>
          <div className="border border-card-border rounded-lg bg-card-raised p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-text-1">
                {lastMeeting.formatName} · {new Date(lastMeeting.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className={cn("text-xs font-bold rounded px-2 py-0.5 border", lastMeeting.isWin ? "text-win bg-win-subtle border-win-ring" : "text-loss bg-loss-subtle border-loss-ring")}>
                {lastMeeting.isWin ? "WON" : "LOST"}
              </span>
            </div>
            <p className="text-mono-xs text-text-2">
              vs {opponentUsername} · {lastMeeting.opponentRating}
            </p>
          </div>
        </div>
      )}
    </div>
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
