import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime, calculateWinRate } from "@/lib/utils";
import { ProfileStats } from "./profile-stats";

// Type definitions
type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

type ParticipationRow = {
  is_winner: boolean;
  commander_name: string | null;
  commander_image_uri: string | null;
  match: {
    id: string;
    format: string;
    date_played: string;
  } | null;
};

interface PageProps {
  params: Promise<{ username: string }>;
}

async function getProfile(username: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  return profile as ProfileRow | null;
}

async function getUserStats(userId: string) {
  const supabase = await createClient();

  // Get all matches this user participated in
  const { data: participations } = await supabase
    .from("match_participants")
    .select(`
      is_winner,
      commander_name,
      commander_image_uri,
      match:match_id (
        id,
        format,
        date_played
      )
    `)
    .eq("user_id", userId)
    .order("match(date_played)", { ascending: false });

  if (!participations) {
    return {
      totalMatches: 0,
      wins: 0,
      winRate: 0,
      currentStreak: 0,
      streakType: "none" as const,
      commanderStats: [],
      recentMatches: [],
    };
  }

  const typedParticipations = participations as unknown as ParticipationRow[];
  const wins = typedParticipations.filter((p) => p.is_winner).length;
  const totalMatches = typedParticipations.length;

  // Calculate streak
  let currentStreak = 0;
  let streakType: "win" | "loss" | "none" = "none";
  for (const p of typedParticipations) {
    if (currentStreak === 0) {
      streakType = p.is_winner ? "win" : "loss";
      currentStreak = 1;
    } else if ((p.is_winner && streakType === "win") || (!p.is_winner && streakType === "loss")) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Commander stats
  const commanderCounts = new Map<string, { name: string; image: string | null; wins: number; total: number }>();
  typedParticipations.forEach((p) => {
    if (p.commander_name) {
      const existing = commanderCounts.get(p.commander_name);
      if (existing) {
        existing.total++;
        if (p.is_winner) existing.wins++;
      } else {
        commanderCounts.set(p.commander_name, {
          name: p.commander_name,
          image: p.commander_image_uri,
          wins: p.is_winner ? 1 : 0,
          total: 1,
        });
      }
    }
  });

  const commanderStats = Array.from(commanderCounts.values())
    .map((c) => ({ ...c, winRate: calculateWinRate(c.wins, c.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalMatches,
    wins,
    winRate: calculateWinRate(wins, totalMatches),
    currentStreak,
    streakType,
    commanderStats,
    recentMatches: typedParticipations.slice(0, 10),
  };
}

type UserMatchRow = {
  is_winner: boolean;
  commander_name: string | null;
  match: {
    id: string;
    format: string;
    date_played: string;
    duration_minutes: number | null;
    groups: { name: string } | null;
  } | null;
};

type MatchParticipantRow = {
  match_id: string;
  user_id: string;
  is_winner: boolean;
  commander_name: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type GuestParticipantRow = {
  id: string;
  match_id: string;
  guest_name: string;
  commander_name: string | null;
  is_winner: boolean;
};

async function getUserMatches(userId: string) {
  const supabase = await createClient();

  const { data: participations } = await supabase
    .from("match_participants")
    .select(`
      is_winner,
      commander_name,
      match:match_id (
        id,
        format,
        date_played,
        duration_minutes,
        groups:group_id (name)
      )
    `)
    .eq("user_id", userId)
    .order("match(date_played)", { ascending: false })
    .limit(20);

  if (!participations) return [];

  const typedParticipations = participations as unknown as UserMatchRow[];

  // For each match, get all participants
  const matchIds = typedParticipations.map((p) => p.match?.id).filter((id): id is string => !!id);
  
  const { data: allParticipants } = await supabase
    .from("match_participants")
    .select(`
      match_id,
      user_id,
      is_winner,
      commander_name,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .in("match_id", matchIds);

  const { data: guestParticipants } = await supabase
    .from("guest_participants")
    .select("*")
    .in("match_id", matchIds);

  const typedAllParticipants = (allParticipants || []) as unknown as MatchParticipantRow[];
  const typedGuestParticipants = (guestParticipants || []) as unknown as GuestParticipantRow[];

  // Group participants by match
  const participantsByMatch = new Map<string, Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    commander_name: string | null;
    is_winner: boolean;
    is_guest: boolean;
    username?: string;
  }>>();

  typedAllParticipants.forEach((p) => {
    const profile = p.profiles;
    const list = participantsByMatch.get(p.match_id) || [];
    list.push({
      id: p.user_id,
      name: profile?.display_name || profile?.username || "Unknown",
      avatar_url: profile?.avatar_url || null,
      commander_name: p.commander_name,
      is_winner: p.is_winner,
      is_guest: false,
      username: profile?.username,
    });
    participantsByMatch.set(p.match_id, list);
  });

  typedGuestParticipants.forEach((g) => {
    const list = participantsByMatch.get(g.match_id) || [];
    list.push({
      id: g.id,
      name: g.guest_name,
      avatar_url: null,
      commander_name: g.commander_name,
      is_winner: g.is_winner,
      is_guest: true,
    });
    participantsByMatch.set(g.match_id, list);
  });

  return typedParticipations.map((p) => {
    const match = p.match;
    if (!match) return null;
    return {
      match: {
        id: match.id,
        format: match.format as "1v1" | "2v2" | "multiplayer",
        date_played: match.date_played,
        duration_minutes: match.duration_minutes,
        group_id: null,
        notes: null,
        created_by: userId,
        created_at: match.date_played,
      },
      participants: participantsByMatch.get(match.id) || [],
      groupName: match.groups?.name || null,
      userIsWinner: p.is_winner,
    };
  }).filter((m): m is NonNullable<typeof m> => m !== null);
}

async function getUserCommanders(userId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_commanders")
    .select("*")
    .eq("user_id", userId)
    .order("is_favorite", { ascending: false })
    .order("created_at", { ascending: false });

  return data || [];
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    notFound();
  }

  const [stats, matches, commanders] = await Promise.all([
    getUserStats(profile.id),
    getUserMatches(profile.id),
    getUserCommanders(profile.id),
  ]);

  const topCommander = stats.commanderStats[0];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0a0a12" }}>
      <Navbar />

      {/* Hero Banner */}
      <section
        style={{
          position: "relative",
          padding: "3rem 1rem",
          background: "linear-gradient(to bottom, rgba(168, 85, 247, 0.1), #0a0a12)",
        }}
      >
        <div style={{ maxWidth: "72rem", marginLeft: "auto", marginRight: "auto", padding: "0 1rem" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
            }}
            className="sm-row"
          >
            {/* Avatar */}
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name || profile.username}
              size="xl"
              style={{ boxShadow: "0 0 0 4px rgba(168, 85, 247, 0.3)" }}
            />

            {/* Info */}
            <div style={{ flex: 1, textAlign: "center" }} className="sm-text-left">
              <h1 style={{ fontSize: "1.875rem", fontWeight: 700, marginBottom: "0.25rem", color: "#ffffff" }}>
                {profile.display_name || profile.username}
              </h1>
              <p style={{ color: "#a1a1aa", marginBottom: "1rem" }}>@{profile.username}</p>

              {/* Quick stats */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "1rem",
                  fontSize: "0.875rem",
                }}
                className="sm-justify-start"
              >
                <div>
                  <span style={{ color: "#a1a1aa" }}>Win Rate: </span>
                  <span style={{ fontWeight: 700, color: "#a855f7" }}>{stats.winRate}%</span>
                </div>
                <div style={{ color: "#ffffff" }}>
                  <span style={{ color: "#a1a1aa" }}>Matches: </span>
                  <span style={{ fontWeight: 700 }}>{stats.totalMatches}</span>
                </div>
                {stats.currentStreak > 0 && (
                  <div>
                    <span style={{ color: "#a1a1aa" }}>Streak: </span>
                    <span style={{ fontWeight: 700, color: stats.streakType === "win" ? "#22c55e" : "#ef4444" }}>
                      {stats.streakType === "win" ? "W" : "L"}{stats.currentStreak}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Top Commander */}
            {topCommander && (
              <div className="hidden-sm" style={{ display: "none" }}>
                <div style={{ fontSize: "0.75rem", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem", textAlign: "center" }}>
                  Top Commander
                </div>
                <div
                  style={{
                    position: "relative",
                    width: "8rem",
                    aspectRatio: "3/4",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                  }}
                >
                  {topCommander.image && (
                    <Image
                      src={topCommander.image}
                      alt={topCommander.name}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  )}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }} />
                  <div style={{ position: "absolute", bottom: "0.5rem", left: "0.5rem", right: "0.5rem" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#ffffff" }}>{topCommander.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "#a1a1aa" }}>
                      {topCommander.winRate}% WR • {topCommander.total} games
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats and content */}
      <section style={{ padding: "2rem 1rem" }}>
        <div style={{ maxWidth: "72rem", marginLeft: "auto", marginRight: "auto", padding: "0 1rem" }}>
          <ProfileStats
            stats={stats}
            matches={matches}
            commanders={commanders}
            userId={profile.id}
          />
        </div>
      </section>
    </div>
  );
}
