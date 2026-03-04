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

interface ParticipantCardProps {
  participant: {
    id: string;
    name: string;
    avatar_url: string | null;
    commander_name: string | null;
    is_winner: boolean;
    is_guest: boolean;
    username?: string;
  };
  isCurrentUser: boolean;
  compact?: boolean;
}

function ParticipantCard({ participant, isCurrentUser, compact = false }: ParticipantCardProps) {
  if (!participant) return null;

  const winnerGlow = participant.is_winner
    ? "0 0 12px rgba(34, 197, 94, 0.4)"
    : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: compact ? "0.375rem" : "0.5rem",
        borderRadius: "0.5rem",
        backgroundColor: participant.is_winner
          ? "rgba(34, 197, 94, 0.1)"
          : "rgba(255, 255, 255, 0.02)",
        border: participant.is_winner
          ? "1px solid rgba(34, 197, 94, 0.3)"
          : "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: winnerGlow,
        minWidth: compact ? "3.5rem" : "4.5rem",
        flex: compact ? "0 0 auto" : "1",
      }}
    >
      {/* Username */}
      <span
        style={{
          fontSize: compact ? "0.625rem" : "0.75rem",
          fontWeight: isCurrentUser ? 600 : 400,
          color: isCurrentUser ? "#a855f7" : participant.is_winner ? "#22c55e" : "#ffffff",
          marginBottom: "0.25rem",
          maxWidth: compact ? "3rem" : "4rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {participant.name}
      </span>

      {/* Commander placeholder/name */}
      <div
        style={{
          width: compact ? "2rem" : "2.5rem",
          height: compact ? "2.75rem" : "3.5rem",
          borderRadius: "0.25rem",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: participant.is_winner
            ? "2px solid rgba(34, 197, 94, 0.5)"
            : "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontSize: "0.5rem",
            color: "#71717a",
            textAlign: "center",
            padding: "0.125rem",
            wordBreak: "break-word",
          }}
        >
          {participant.commander_name?.split(",")[0]?.slice(0, 12) || "?"}
        </span>
      </div>

      {/* Winner crown */}
      {participant.is_winner && (
        <span style={{ fontSize: compact ? "0.625rem" : "0.75rem", marginTop: "0.125rem" }}>
          👑
        </span>
      )}
    </div>
  );
}

export function ProfileStats({ stats, matches, commanders, userId }: ProfileStatsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Stat Cards Row */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "1rem",
        }}
        className="lg-grid-4"
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(1, 1fr)",
          gap: "1.5rem",
        }}
        className="lg-grid-2"
      >
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
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {matches.length > 0 ? (
              matches.slice(0, 5).map((m, index) => {
                const winners = m.participants.filter((p) => p.is_winner);
                const losers = m.participants.filter((p) => !p.is_winner);

                return (
                  <motion.div
                    key={m.match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Link
                      href={`/match/${m.match.id}`}
                      style={{
                        display: "block",
                        padding: "1rem",
                        borderRadius: "0.75rem",
                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        textDecoration: "none",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                      }}
                    >
                      {/* Match header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Badge variant={m.userIsWinner ? "win" : "loss"}>
                            {m.userIsWinner ? "WIN" : "LOSS"}
                          </Badge>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "#a1a1aa",
                              padding: "0.25rem 0.5rem",
                              backgroundColor: "rgba(255, 255, 255, 0.05)",
                              borderRadius: "0.25rem",
                            }}
                          >
                            {m.match.format.toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#71717a" }}>
                          {formatRelativeTime(m.match.date_played)}
                        </span>
                      </div>

                      {/* Participants display based on format */}
                      {m.match.format === "1v1" ? (
                        /* 1v1: Two participants side by side with VS */
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          {/* Player 1 */}
                          <ParticipantCard
                            participant={m.participants[0]}
                            isCurrentUser={m.participants[0]?.id === userId}
                          />
                          <span style={{ color: "#71717a", fontWeight: 600, fontSize: "0.75rem" }}>VS</span>
                          {/* Player 2 */}
                          <ParticipantCard
                            participant={m.participants[1]}
                            isCurrentUser={m.participants[1]?.id === userId}
                          />
                        </div>
                      ) : m.match.format === "2v2" ? (
                        /* 2v2: Two teams with VS */
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr auto 1fr",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          {/* Team 1 (winners or first 2) */}
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            {winners.slice(0, 2).map((p) => (
                              <ParticipantCard
                                key={p.id}
                                participant={p}
                                isCurrentUser={p.id === userId}
                                compact
                              />
                            ))}
                          </div>
                          <span style={{ color: "#71717a", fontWeight: 600, fontSize: "0.75rem" }}>VS</span>
                          {/* Team 2 (losers) */}
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            {losers.slice(0, 2).map((p) => (
                              <ParticipantCard
                                key={p.id}
                                participant={p}
                                isCurrentUser={p.id === userId}
                                compact
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        /* Multiplayer: Grid of participants */
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.5rem",
                          }}
                        >
                          {m.participants.map((p) => (
                            <ParticipantCard
                              key={p.id}
                              participant={p}
                              isCurrentUser={p.id === userId}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </Link>
                  </motion.div>
                );
              })
            ) : (
              <p style={{ color: "#a1a1aa", fontSize: "0.875rem" }}>No matches recorded yet.</p>
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
