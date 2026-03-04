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
    commander_image_uri?: string | null;
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

  // Fetch commander names from both match_participants and guest_participants
  const { data: matchData } = await supabase
    .from("match_participants")
    .select("commander_name")
    .not("commander_name", "is", null)
    .limit(100);

  const { data: guestData } = await supabase
    .from("guest_participants")
    .select("commander_name")
    .not("commander_name", "is", null)
    .limit(100);

  const allData = [
    ...((matchData || []) as Array<{ commander_name: string | null }>),
    ...((guestData || []) as Array<{ commander_name: string | null }>),
  ];

  if (allData.length === 0) return [];

  // Count commander occurrences
  const counts = new Map<string, { name: string; count: number }>();
  allData.forEach((p) => {
    if (p.commander_name) {
      const existing = counts.get(p.commander_name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(p.commander_name, {
          name: p.commander_name,
          count: 1,
        });
      }
    }
  });

  const topCommanders = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Fetch images from user_commanders table
  const commanderNames = topCommanders.map((c) => c.name);
  const { data: commanderImages } = await supabase
    .from("user_commanders")
    .select("card_name, card_image_uri")
    .in("card_name", commanderNames);

  // Create a map of commander name to image
  const imageMap = new Map<string, string>();
  ((commanderImages || []) as Array<{ card_name: string; card_image_uri: string | null }>).forEach((c) => {
    if (c.card_image_uri && !imageMap.has(c.card_name)) {
      imageMap.set(c.card_name, c.card_image_uri);
    }
  });

  // Combine counts with images
  return topCommanders.map((c) => ({
    name: c.name,
    image: imageMap.get(c.name) || "",
    count: c.count,
  }));
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
      ),
      guest_participants (
        id,
        guest_name,
        is_winner,
        commander_name
      )
    `)
    .order("date_played", { ascending: false })
    .limit(5);

  // Collect all commander names to fetch images
  const allCommanderNames = new Set<string>();
  (matches || []).forEach((match: Record<string, unknown>) => {
    const matchParticipants = (match.match_participants || []) as Array<{ commander_name: string | null }>;
    const guestParticipants = (match.guest_participants || []) as Array<{ commander_name: string | null }>;
    matchParticipants.forEach((p) => p.commander_name && allCommanderNames.add(p.commander_name));
    guestParticipants.forEach((p) => p.commander_name && allCommanderNames.add(p.commander_name));
  });

  // Fetch commander images from user_commanders table
  const { data: commanderImages } = await supabase
    .from("user_commanders")
    .select("card_name, card_image_uri")
    .in("card_name", Array.from(allCommanderNames));

  const imageMap = new Map<string, string>();
  ((commanderImages || []) as Array<{ card_name: string; card_image_uri: string | null }>).forEach((c) => {
    if (c.card_image_uri && !imageMap.has(c.card_name)) {
      imageMap.set(c.card_name, c.card_image_uri);
    }
  });

  // Combine registered users and guest participants
  const processedMatches = (matches || []).map((match: Record<string, unknown>) => {
    const matchParticipants = (match.match_participants || []) as Array<{
      user_id: string;
      is_winner: boolean;
      commander_name: string | null;
      profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
    }>;
    const guestParticipants = (match.guest_participants || []) as Array<{
      id: string;
      guest_name: string;
      is_winner: boolean;
      commander_name: string | null;
    }>;

    // Convert guest participants to the same format and add commander images
    const allParticipants = [
      ...matchParticipants.map((p) => ({
        ...p,
        commander_image_uri: p.commander_name ? imageMap.get(p.commander_name) || null : null,
      })),
      ...guestParticipants.map((g) => ({
        user_id: g.id,
        is_winner: g.is_winner,
        commander_name: g.commander_name,
        commander_image_uri: g.commander_name ? imageMap.get(g.commander_name) || null : null,
        profiles: {
          username: g.guest_name,
          display_name: g.guest_name,
          avatar_url: null,
        },
      })),
    ];

    return {
      id: match.id as string,
      format: match.format as string,
      date_played: match.date_played as string,
      match_participants: allParticipants,
    };
  });

  return processedMatches as MatchResult[];
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

// Participant card for landing page matches
function LandingParticipantCard({
  participant,
  compact = false,
}: {
  participant: {
    user_id: string;
    is_winner: boolean;
    commander_name: string | null;
    commander_image_uri?: string | null;
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  } | undefined;
  compact?: boolean;
}) {
  if (!participant) return null;

  const name = participant.profiles?.display_name || participant.profiles?.username || "Unknown";
  const winnerGlow = participant.is_winner ? "0 0 8px rgba(34, 197, 94, 0.4)" : undefined;
  const hasImage = !!participant.commander_image_uri;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: compact ? "0.25rem" : "0.375rem",
        borderRadius: "0.375rem",
        backgroundColor: participant.is_winner
          ? "rgba(34, 197, 94, 0.1)"
          : "rgba(255, 255, 255, 0.02)",
        border: participant.is_winner
          ? "1px solid rgba(34, 197, 94, 0.3)"
          : "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: winnerGlow,
        minWidth: compact ? "2.5rem" : "3.5rem",
        flex: compact ? "0 0 auto" : "1",
      }}
    >
      {/* Username */}
      <span
        style={{
          fontSize: compact ? "0.5rem" : "0.625rem",
          fontWeight: participant.is_winner ? 600 : 400,
          color: participant.is_winner ? "#22c55e" : "#ffffff",
          marginBottom: "0.125rem",
          maxWidth: compact ? "2.25rem" : "3rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>

      {/* Commander card */}
      <div
        style={{
          position: "relative",
          width: compact ? "1.5rem" : "2rem",
          height: compact ? "2rem" : "2.75rem",
          borderRadius: "0.125rem",
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          border: participant.is_winner
            ? "2px solid rgba(34, 197, 94, 0.5)"
            : "1px solid rgba(255, 255, 255, 0.08)",
          overflow: "hidden",
        }}
      >
        {hasImage ? (
          <Image
            src={participant.commander_image_uri!}
            alt={participant.commander_name || "Commander"}
            fill
            unoptimized
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "0.375rem",
                color: "#71717a",
                textAlign: "center",
                padding: "0.0625rem",
                wordBreak: "break-word",
                lineHeight: 1.1,
              }}
            >
              {participant.commander_name?.split(",")[0]?.slice(0, 10) || "?"}
            </span>
          </div>
        )}
      </div>

      {/* Winner crown */}
      {participant.is_winner && (
        <span style={{ fontSize: compact ? "0.5rem" : "0.625rem", marginTop: "0.0625rem" }}>
          👑
        </span>
      )}
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
                    unoptimized
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
      <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {matches.length === 0 ? (
          <p style={{ color: "#a1a1aa" }} className="text-sm">
            No matches yet. Start tracking!
          </p>
        ) : (
          matches.map((match) => {
            const participants = (match.match_participants || []) as Array<{
              user_id: string;
              is_winner: boolean;
              commander_name: string | null;
              profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
            }>;
            const winners = participants.filter((p) => p.is_winner);
            const losers = participants.filter((p) => !p.is_winner);

            return (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                style={{
                  display: "block",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  textDecoration: "none",
                  transition: "background-color 0.2s",
                }}
              >
                {/* Match header */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      padding: "0.125rem 0.375rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "rgba(168,85,247,0.2)",
                      color: "#a855f7",
                    }}
                  >
                    {match.format === "1v1"
                      ? "1v1"
                      : match.format === "2v2"
                        ? "2v2"
                        : `${participants.length}P`}
                  </span>
                  <span style={{ fontSize: "0.625rem", color: "#71717a" }}>
                    {formatRelativeTime(match.date_played)}
                  </span>
                </div>

                {/* Participants display based on format */}
                {match.format === "1v1" ? (
                  /* 1v1: Two participants side by side with VS */
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <LandingParticipantCard participant={participants[0]} />
                    <span style={{ color: "#71717a", fontWeight: 600, fontSize: "0.625rem" }}>VS</span>
                    <LandingParticipantCard participant={participants[1]} />
                  </div>
                ) : match.format === "2v2" ? (
                  /* 2v2: Two teams with VS */
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto 1fr",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {winners.slice(0, 2).map((p) => (
                        <LandingParticipantCard key={p.user_id} participant={p} compact />
                      ))}
                    </div>
                    <span style={{ color: "#71717a", fontWeight: 600, fontSize: "0.625rem" }}>VS</span>
                    <div style={{ display: "flex", gap: "0.25rem", justifyContent: "flex-end" }}>
                      {losers.slice(0, 2).map((p) => (
                        <LandingParticipantCard key={p.user_id} participant={p} compact />
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Multiplayer: Grid of participants */
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.25rem",
                      justifyContent: "center",
                    }}
                  >
                    {participants.map((p) => (
                      <LandingParticipantCard key={p.user_id} participant={p} compact />
                    ))}
                  </div>
                )}
              </Link>
            );
          })
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
      <Navbar hideSearch />

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
