"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, formatDuration } from "@/lib/utils";
import type { Match, UserCommander } from "@/types/database.types";

interface CommanderStat {
  name: string;
  image: string | null;
  wins: number;
  total: number;
  winRate: number;
}

interface MatchWithParticipants {
  match: Match;
  participants: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    commander_name: string | null;
    is_winner: boolean;
    is_guest: boolean;
    username?: string;
  }>;
  groupName: string | null;
  userIsWinner: boolean;
}

interface ProfileStatsProps {
  stats: {
    totalMatches: number;
    wins: number;
    winRate: number;
    currentStreak: number;
    streakType: "win" | "loss" | "none";
    commanderStats: CommanderStat[];
  };
  matches: MatchWithParticipants[];
  commanders: UserCommander[];
  userId: string;
}

export function ProfileStats({ stats, matches, commanders, userId }: ProfileStatsProps) {
  return (
    <div className="space-y-8">
      {/* Stat Cards Row */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          icon={<span>🏆</span>}
          value={`${stats.winRate}%`}
          label="Win Rate"
          delay={0}
        />
        <StatCard
          icon={<span>📊</span>}
          value={stats.totalMatches}
          label="Matches"
          delay={0.1}
        />
        <StatCard
          icon={<span>👑</span>}
          value={stats.wins}
          label="Wins"
          delay={0.2}
        />
        <StatCard
          icon={<span>🔥</span>}
          value={stats.currentStreak > 0 ? `${stats.streakType === "win" ? "W" : "L"}${stats.currentStreak}` : "-"}
          label="Streak"
          delay={0.3}
        />
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Commander Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commander Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.commanderStats.length > 0 ? (
              stats.commanderStats.map((commander, index) => (
                <motion.div
                  key={commander.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="flex items-center gap-3"
                >
                  <div className="relative h-12 w-9 rounded overflow-hidden flex-shrink-0 bg-surface">
                    {commander.image && (
                      <Image
                        src={commander.image}
                        alt={commander.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{commander.name}</div>
                    <div className="text-xs text-foreground-muted">
                      {commander.total} games • {commander.wins} wins
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${commander.winRate >= 50 ? "text-win" : "text-loss"}`}>
                      {commander.winRate}%
                    </div>
                  </div>
                  {/* Win rate bar */}
                  <div className="w-20 h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${commander.winRate}%` }}
                      transition={{ delay: 0.3 + 0.1 * index, duration: 0.5 }}
                      className="h-full bg-gradient-accent"
                    />
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-foreground-muted text-sm">No matches recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.length > 0 ? (
              matches.slice(0, 8).map((m, index) => (
                <motion.div
                  key={m.match.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link
                    href={`/match/${m.match.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors"
                  >
                    {/* Win/Loss indicator */}
                    <div
                      className={`w-1 h-8 rounded-full ${
                        m.userIsWinner ? "bg-win" : "bg-loss"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={m.userIsWinner ? "win" : "loss"} className="text-[10px]">
                          {m.userIsWinner ? "WIN" : "LOSS"}
                        </Badge>
                        <span className="text-sm text-foreground-muted">
                          {m.match.format === "1v1"
                            ? "1v1"
                            : m.match.format === "2v2"
                            ? "2v2"
                            : `${m.participants.length}-player`}
                        </span>
                      </div>
                      <div className="text-xs text-foreground-subtle truncate">
                        vs {m.participants.filter((p) => p.id !== userId).map((p) => p.name).join(", ")}
                      </div>
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {formatRelativeTime(m.match.date_played)}
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <p className="text-foreground-muted text-sm">No matches recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commander Collection */}
      {commanders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Commander Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {commanders.map((commander, index) => (
                <motion.div
                  key={commander.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.02 * index }}
                  className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface group"
                >
                  {commander.card_image_uri && (
                    <Image
                      src={commander.card_image_uri}
                      alt={commander.card_name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  {commander.is_favorite && (
                    <div className="absolute top-1 right-1 text-yellow-500 text-sm">⭐</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-xs font-medium truncate">{commander.card_name}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
