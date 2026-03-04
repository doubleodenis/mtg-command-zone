import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";
import { formatRelativeTime } from "@/lib/utils";
import { LandingSearch } from "./landing-search";

// Type definitions for query results
type CommanderResult = {
  commander_name: string | null;
  commander_image_uri: string | null;
};

type MatchResult = {
  id: string;
  format: string;
  date_played: string;
  match_participants: Array<{
    user_id: string;
    is_winner: boolean;
    commander_name: string | null;
    profiles: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  }>;
};

type ParticipantResult = {
  user_id: string;
  is_winner: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

async function getTopCommanders() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("match_participants")
    .select("commander_name, commander_image_uri")
    .not("commander_name", "is", null)
    .limit(100);

  if (!data) return [];

  const counts = new Map<string, { name: string; image: string; count: number }>();
  (data as CommanderResult[]).forEach((p) => {
    if (p.commander_name) {
      const existing = counts.get(p.commander_name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(p.commander_name, {
          name: p.commander_name,
          image: p.commander_image_uri || "",
          count: 1,
        });
      }
    }
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

async function getRecentMatches() {
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("matches")
    .select(`
      id,
      format,
      date_played,
      match_participants (
        user_id,
        is_winner,
        commander_name,
        profiles:user_id (
          username,
          display_name,
          avatar_url
        )
      )
    `)
    .order("date_played", { ascending: false })
    .limit(5);

  return (matches as unknown as MatchResult[]) || [];
}

async function getLeaderboard() {
  const supabase = await createClient();

  const { data: participants } = await supabase
    .from("match_participants")
    .select(`
      user_id,
      is_winner,
      profiles:user_id (
        username,
        display_name,
        avatar_url
      )
    `);

  if (!participants) return [];

  const stats = new Map<
    string,
    {
      user_id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      wins: number;
      total: number;
    }
  >();

  (participants as unknown as ParticipantResult[]).forEach((p) => {
    if (!p.user_id || !p.profiles) return;
    const profile = p.profiles;

    const existing = stats.get(p.user_id);
    if (existing) {
      existing.total++;
      if (p.is_winner) existing.wins++;
    } else {
      stats.set(p.user_id, {
        user_id: p.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        wins: p.is_winner ? 1 : 0,
        total: 1,
      });
    }
  });

  return Array.from(stats.values())
    .filter((s) => s.total >= 5)
    .map((s) => ({
      ...s,
      winRate: Math.round((s.wins / s.total) * 100),
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 10);
}

// Card wrapper component with explicit styling
function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        backgroundColor: "rgba(18, 18, 26, 0.9)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {children}
    </div>
  );
}

function TopCommandersSection({
  commanders,
}: {
  commanders: Awaited<ReturnType<typeof getTopCommanders>>;
}) {
  return (
    <SectionCard>
      <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span style={{ color: "#a855f7" }}>⚔️</span>
          Top Commanders
        </h3>
      </div>
      <div className="p-5">
        {commanders.length === 0 ? (
          <p style={{ color: "#a1a1aa" }} className="text-sm">
            No matches recorded yet. Be the first!
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {commanders.map((commander, idx) => (
              <div
                key={commander.name}
                className="relative group rounded-lg overflow-hidden"
                style={{
                  aspectRatio: "3/4",
                  backgroundColor: "rgba(255,255,255,0.03)",
                }}
              >
                {commander.image && (
                  <Image
                    src={commander.image}
                    alt={commander.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
                  }}
                />
                <div className="absolute top-2 left-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: idx === 0 ? "#a855f7" : "rgba(255,255,255,0.1)",
                      color: "#fff",
                    }}
                  >
                    #{idx + 1}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="font-medium text-sm truncate text-white">
                    {commander.name}
                  </div>
                  <div className="text-xs" style={{ color: "#a1a1aa" }}>
                    {commander.count} {commander.count === 1 ? "match" : "matches"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function RecentMatchesSection({
  matches,
}: {
  matches: Awaited<ReturnType<typeof getRecentMatches>>;
}) {
  return (
    <SectionCard>
      <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span style={{ color: "#22d3ee" }}>🎮</span>
          Recent Matches
        </h3>
      </div>
      <div className="p-5">
        {matches.length === 0 ? (
          <p style={{ color: "#a1a1aa" }} className="text-sm">
            No matches yet. Start tracking!
          </p>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const participants = (match.match_participants || []) as Array<{
                user_id: string;
                is_winner: boolean;
                commander_name: string | null;
                profiles: { username: string; display_name: string | null } | null;
              }>;
              const winner = participants.find((p) => p.is_winner);
              const winnerName =
                winner?.profiles?.display_name || winner?.profiles?.username;

              return (
                <Link
                  key={match.id}
                  href={`/match/${match.id}`}
                  className="block p-3 rounded-lg transition-all duration-200"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded"
                        style={{
                          backgroundColor:
                            match.format === "commander"
                              ? "rgba(168,85,247,0.2)"
                              : "rgba(34,211,238,0.2)",
                          color:
                            match.format === "commander" ? "#a855f7" : "#22d3ee",
                        }}
                      >
                        {match.format === "1v1"
                          ? "1v1"
                          : match.format === "2v2"
                            ? "2v2"
                            : `${participants.length}P`}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "#71717a" }}>
                      {formatRelativeTime(match.date_played)}
                    </span>
                  </div>
                  {winnerName && (
                    <div className="text-sm" style={{ color: "#a1a1aa" }}>
                      Winner:{" "}
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>
                        {winnerName}
                      </span>
                      {winner?.commander_name && (
                        <span style={{ color: "#71717a" }}>
                          {" "}
                          • {winner.commander_name}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function LeaderboardSection({
  leaders,
}: {
  leaders: Awaited<ReturnType<typeof getLeaderboard>>;
}) {
  return (
    <SectionCard>
      <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <span style={{ color: "#22c55e" }}>🏆</span>
          Leaderboard
        </h3>
      </div>
      <div className="p-5">
        {leaders.length === 0 ? (
          <p style={{ color: "#a1a1aa" }} className="text-sm">
            Play 5+ matches to appear here!
          </p>
        ) : (
          <div className="space-y-1">
            {leaders.map((leader, index) => (
              <Link
                key={leader.user_id}
                href={`/player/${leader.username}`}
                className="flex items-center gap-3 p-2 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor:
                    index === 0 ? "rgba(168,85,247,0.1)" : "transparent",
                }}
              >
                <span
                  className="w-6 text-center font-bold text-sm"
                  style={{
                    color: index === 0 ? "#a855f7" : index < 3 ? "#22d3ee" : "#71717a",
                  }}
                >
                  {index + 1}
                </span>
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  {leader.avatar_url ? (
                    <Image
                      src={leader.avatar_url}
                      alt={leader.username}
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  ) : (
                    <span
                      className="text-xs font-medium"
                      style={{ color: "#a1a1aa" }}
                    >
                      {leader.username.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-white">
                    {leader.display_name || leader.username}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color: "#22c55e" }}>
                    {leader.winRate}%
                  </div>
                  <div className="text-xs" style={{ color: "#71717a" }}>
                    {leader.total} games
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default async function HomePage() {
  const [commanders, matches, leaderboard] = await Promise.all([
    getTopCommanders(),
    getRecentMatches(),
    getLeaderboard(),
  ]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0f" }}>
      <Navbar />

      {/* Hero Section - Inspired by OP.GG */}
      <section style={{ paddingTop: "4rem", paddingBottom: "2rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
        <div style={{ maxWidth: "56rem", marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-white">
            Track Your{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Commander
            </span>{" "}
            Matches
          </h1>
          <p
            style={{ color: "#a1a1aa", fontSize: "1.125rem", marginBottom: "2.5rem", maxWidth: "42rem", marginLeft: "auto", marginRight: "auto" }}
          >
            Record games, track stats, and see how you stack up against your
            playgroup.
          </p>

          {/* Search Bar - OP.GG style */}
          <div style={{ maxWidth: "36rem", marginLeft: "auto", marginRight: "auto" }}>
            <Suspense
              fallback={
                <div
                  className="h-14 rounded-xl animate-pulse"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                />
              }
            >
              <LandingSearch />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Stats Grid - Leetify/Statlocker style */}
      <section style={{ paddingTop: "2.5rem", paddingBottom: "2.5rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
        <div style={{ maxWidth: "72rem", marginLeft: "auto", marginRight: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
              gap: "1.5rem",
            }}
            className="md:grid-cols-3"
          >
            <TopCommandersSection commanders={commanders} />
            <RecentMatchesSection matches={matches} />
            <LeaderboardSection leaders={leaderboard} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ paddingTop: "4rem", paddingBottom: "4rem", paddingLeft: "1rem", paddingRight: "1rem" }}>
        <div
          style={{
            maxWidth: "42rem",
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
            padding: "2rem",
            borderRadius: "1rem",
            background:
              "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(34,211,238,0.1) 100%)",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          <h2 className="text-2xl font-bold mb-3 text-white">
            Ready to get started?
          </h2>
          <p style={{ marginBottom: "1.5rem", color: "#a1a1aa" }}>
            Sign up to track your matches, build your commander collection, and
            compete with friends.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center"
            style={{
              height: "3rem",
              paddingLeft: "2rem",
              paddingRight: "2rem",
              borderRadius: "0.5rem",
              fontWeight: 600,
              backgroundColor: "#a855f7",
              color: "#fff",
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.4)",
            }}
          >
            Create Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          paddingTop: "2rem",
          paddingBottom: "2rem",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: "72rem", marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "#71717a" }}>
            MTG Commander Tracker • Built with Next.js &amp; Supabase
          </p>
        </div>
      </footer>
    </div>
  );
}
