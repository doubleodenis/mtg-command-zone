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
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Banner */}
      <section className="relative py-12 px-4 bg-gradient-to-b from-accent/10 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name || profile.username}
              size="xl"
              className="ring-4 ring-accent/30"
            />

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-3xl font-bold mb-1">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-foreground-muted mb-4">@{profile.username}</p>

              {/* Quick stats */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-sm">
                <div>
                  <span className="text-foreground-muted">Win Rate: </span>
                  <span className="font-bold text-accent">{stats.winRate}%</span>
                </div>
                <div>
                  <span className="text-foreground-muted">Matches: </span>
                  <span className="font-bold">{stats.totalMatches}</span>
                </div>
                {stats.currentStreak > 0 && (
                  <div>
                    <span className="text-foreground-muted">Streak: </span>
                    <span className={`font-bold ${stats.streakType === "win" ? "text-win" : "text-loss"}`}>
                      {stats.streakType === "win" ? "W" : "L"}{stats.currentStreak}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Top Commander */}
            {topCommander && (
              <div className="hidden lg:block">
                <div className="text-xs text-foreground-muted uppercase tracking-wider mb-2 text-center">
                  Top Commander
                </div>
                <div className="relative w-32 aspect-[3/4] rounded-lg overflow-hidden">
                  {topCommander.image && (
                    <Image
                      src={topCommander.image}
                      alt={topCommander.name}
                      fill
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="text-sm font-medium truncate">{topCommander.name}</div>
                    <div className="text-xs text-foreground-muted">
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
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
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
