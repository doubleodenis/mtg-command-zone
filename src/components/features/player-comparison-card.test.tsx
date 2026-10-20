import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerComparisonCard } from "./player-comparison-card";
import type { ComparisonData } from "./player-comparison-card";

vi.mock("@/components/features/rivalry-meetings-chart", () => ({ RivalryMeetingsChart: () => null }));

const stats = { totalMatches: 1, wins: 0, losses: 1, winRate: 0, currentStreak: 0, longestWinStreak: 0 };

function data(overrides: Partial<ComparisonData> = {}): ComparisonData {
  return {
    you: { id: "u1", username: "you", displayName: null, avatarUrl: null, stats, rating: 1000 },
    opponent: { id: "u2", username: "them", displayName: null, avatarUrl: null, stats, rating: 1000 },
    asEnemies: { wins: 0, losses: 1, matchesPlayed: 1, winRate: 0 },
    asTeammates: { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0 },
    byFormat: [],
    firstMetAt: null,
    mostRecentMatchAt: null,
    currentStreak: null,
    meetings: [],
    ratingGapTrend: null,
    ...overrides,
  };
}

describe("PlayerComparisonCard — sparse rivalry", () => {
  it("says the chart counts confirmed matches", () => {
    render(<PlayerComparisonCard data={data()} />);
    expect(screen.getByText("Rivalry chart unlocks at 3 confirmed matches")).toBeInTheDocument();
  });

  it("explains shared matches that don't count yet", () => {
    render(<PlayerComparisonCard data={data()} />);
    expect(screen.getByText("1 shared match waiting on confirmation")).toBeInTheDocument();
  });

  it("pluralises the pending count across enemy and teammate matches", () => {
    render(
      <PlayerComparisonCard
        data={data({ asTeammates: { wins: 1, losses: 0, matchesPlayed: 1, winRate: 100 } })}
      />
    );
    expect(screen.getByText("2 shared matches waiting on confirmation")).toBeInTheDocument();
  });

  it("shows no pending hint when every shared match is confirmed", () => {
    const meeting = {
      matchId: "m1", playedAt: "2026-09-30T00:00:00Z", formatSlug: "ffa", formatName: "FFA",
      isWin: false, yourRating: 990, yourRatingBefore: 1000, opponentRating: 1010,
    };
    render(<PlayerComparisonCard data={data({ meetings: [meeting] })} />);
    expect(screen.queryByText(/waiting on confirmation/)).not.toBeInTheDocument();
  });
});
