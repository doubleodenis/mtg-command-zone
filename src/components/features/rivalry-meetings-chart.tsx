"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Meeting = {
  matchId: string;
  playedAt: string;
  formatSlug: string;
  formatName: string;
  isWin: boolean;
  yourRating: number;
  opponentRating: number;
};

type RivalryMeetingsChartProps = {
  meetings: Meeting[];
  youLabel: string;
  opponentLabel: string;
  height?: number;
};

/**
 * Line chart of both players' ratings across their shared match history.
 * One dot per meeting, colored by the current user's outcome that match.
 */
export function RivalryMeetingsChart({
  meetings,
  youLabel,
  opponentLabel,
  height = 190,
}: RivalryMeetingsChartProps) {
  const chartData = meetings.map((m, index) => ({
    index,
    date: new Date(m.playedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    you: m.yourRating,
    opponent: m.opponentRating,
    isWin: m.isWin,
    formatName: m.formatName,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#17171c" vertical={false} />
        <XAxis
          dataKey="date"
          axisLine={{ stroke: "#222228" }}
          tickLine={{ stroke: "#222228" }}
          tick={{ fill: "#8b909c", fontSize: 10 }}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8b909c", fontSize: 10 }}
          width={40}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof chartData)[number];
            return (
              <div className="bg-card border border-card-border rounded-lg p-2 shadow-lg">
                <p className="text-xs text-text-2">{point.date} · {point.formatName}</p>
                <p className="text-sm font-display font-bold text-accent">
                  {youLabel}: {point.you}
                </p>
                <p className="text-sm font-display font-bold text-gold">
                  {opponentLabel}: {point.opponent}
                </p>
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="you"
          stroke="#aa28d8"
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload, index } = props;
            const color = payload.isWin ? "#44c070" : "#e05555";
            return (
              <circle
                key={`you-dot-${index}`}
                cx={cx}
                cy={cy}
                r={4}
                fill={color}
                stroke={color}
              />
            );
          }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="opponent"
          stroke="#d4a843"
          strokeWidth={2.5}
          strokeOpacity={0.85}
          dot={false}
          activeDot={{ r: 5, fill: "#d4a843" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type { RivalryMeetingsChartProps };
