import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime, formatDuration } from "@/lib/utils";

// Type definitions
type MatchRow = {
  id: string;
  format: string;
  date_played: string;
  duration_minutes: number | null;
  notes: string | null;
  group_id: string | null;
  created_by: string;
  groups: { name: string; description: string | null } | null;
  created_by_profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RegisteredParticipantRow = {
  user_id: string;
  commander_name: string | null;
  commander_image_uri: string | null;
  team: number | null;
  placement: number | null;
  is_winner: boolean;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type GuestParticipantRow = {
  id: string;
  guest_name: string;
  commander_name: string | null;
  commander_image_uri: string | null;
  team: number | null;
  placement: number | null;
  is_winner: boolean;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getMatch(id: string) {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select(`
      *,
      groups:group_id (name, description),
      created_by_profile:created_by (username, display_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  return match as MatchRow | null;
}

async function getParticipants(matchId: string) {
  const supabase = await createClient();

  const { data: registered } = await supabase
    .from("match_participants")
    .select(`
      *,
      profiles:user_id (id, username, display_name, avatar_url)
    `)
    .eq("match_id", matchId);

  const { data: guests } = await supabase
    .from("guest_participants")
    .select("*")
    .eq("match_id", matchId);

  const typedRegistered = (registered || []) as unknown as RegisteredParticipantRow[];
  const typedGuests = (guests || []) as unknown as GuestParticipantRow[];

  const participants: Array<{
    id: string;
    name: string;
    username?: string;
    avatar_url: string | null;
    commander_name: string | null;
    commander_image_uri: string | null;
    team: number | null;
    placement: number | null;
    is_winner: boolean;
    is_guest: boolean;
  }> = [];

  typedRegistered.forEach((p) => {
    const profile = p.profiles;

    participants.push({
      id: p.user_id,
      name: profile?.display_name || profile?.username || "Unknown",
      username: profile?.username,
      avatar_url: profile?.avatar_url || null,
      commander_name: p.commander_name,
      commander_image_uri: p.commander_image_uri,
      team: p.team,
      placement: p.placement,
      is_winner: p.is_winner,
      is_guest: false,
    });
  });

  typedGuests.forEach((g) => {
    participants.push({
      id: g.id,
      name: g.guest_name,
      avatar_url: null,
      commander_name: g.commander_name,
      commander_image_uri: g.commander_image_uri,
      team: g.team,
      placement: g.placement,
      is_winner: g.is_winner,
      is_guest: true,
    });
  });

  // Sort by placement if available, winners first
  participants.sort((a, b) => {
    if (a.is_winner && !b.is_winner) return -1;
    if (!a.is_winner && b.is_winner) return 1;
    if (a.placement && b.placement) return a.placement - b.placement;
    return 0;
  });

  return participants;
}

export default async function MatchDetailPage({ params }: PageProps) {
  const { id } = await params;
  const match = await getMatch(id);

  if (!match) {
    notFound();
  }

  const participants = await getParticipants(id);
  const winner = participants.find((p) => p.is_winner);
  const group = match.groups as { name: string; description: string | null } | null;
  const createdBy = match.created_by_profile as {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  const formatLabel =
    match.format === "1v1"
      ? "1v1 Commander"
      : match.format === "2v2"
      ? "2v2 Commander"
      : `${participants.length}-Player Commander`;

  // Group participants by team for 2v2
  const teams = match.format === "2v2"
    ? [
        participants.filter((p) => p.team === 1),
        participants.filter((p) => p.team === 2),
      ]
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto max-w-4xl py-8 px-4">
        {/* Match Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{formatLabel}</h1>
            {group && (
              <Badge variant="outline">{group.name}</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-foreground-muted text-sm">
            <span>{new Date(match.date_played).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}</span>
            {match.duration_minutes && (
              <span>• {formatDuration(match.duration_minutes)}</span>
            )}
            {createdBy && (
              <span>
                • Recorded by{" "}
                <Link href={`/player/${createdBy.username}`} className="text-accent hover:underline">
                  @{createdBy.username}
                </Link>
              </span>
            )}
          </div>
        </div>

        {/* Winner Banner */}
        {winner && (
          <Card className="mb-8 overflow-hidden">
            <div className="h-2 bg-gradient-accent" />
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-4">
                <span className="text-4xl">👑</span>
                <div className="text-center">
                  <div className="text-sm text-foreground-muted uppercase tracking-wider mb-1">
                    Winner
                  </div>
                  <div className="text-2xl font-bold">
                    {winner.username ? (
                      <Link href={`/player/${winner.username}`} className="hover:text-accent transition-colors">
                        {winner.name}
                      </Link>
                    ) : (
                      winner.name
                    )}
                  </div>
                  {winner.commander_name && (
                    <div className="text-foreground-muted mt-1">
                      playing {winner.commander_name}
                    </div>
                  )}
                </div>
                {winner.commander_image_uri && (
                  <div className="relative h-24 w-18 rounded-lg overflow-hidden hidden sm:block">
                    <Image
                      src={winner.commander_image_uri}
                      alt={winner.commander_name || "Commander"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participants */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {teams ? (
              // 2v2 layout
              <div className="grid md:grid-cols-2 gap-6">
                {teams.map((team, teamIndex) => (
                  <div key={teamIndex}>
                    <div className="text-sm font-medium text-foreground-muted mb-3">
                      Team {teamIndex + 1}
                      {team.some((p) => p.is_winner) && (
                        <Badge variant="win" className="ml-2">Winners</Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      {team.map((participant) => (
                        <ParticipantCard key={participant.id} participant={participant} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // FFA layout
              <div className="grid sm:grid-cols-2 gap-4">
                {participants.map((participant) => (
                  <ParticipantCard key={participant.id} participant={participant} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {match.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground-muted whitespace-pre-wrap">{match.notes}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function ParticipantCard({
  participant,
}: {
  participant: {
    id: string;
    name: string;
    username?: string;
    avatar_url: string | null;
    commander_name: string | null;
    commander_image_uri: string | null;
    placement: number | null;
    is_winner: boolean;
    is_guest: boolean;
  };
}) {
  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
        participant.is_winner
          ? "bg-win/10 ring-1 ring-win/30"
          : "bg-surface hover:bg-surface-hover"
      }`}
    >
      {/* Commander Image */}
      {participant.commander_image_uri ? (
        <div className="relative h-16 w-12 rounded overflow-hidden flex-shrink-0">
          <Image
            src={participant.commander_image_uri}
            alt={participant.commander_name || "Commander"}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="h-16 w-12 rounded bg-surface-hover flex items-center justify-center text-foreground-muted text-xs">
          ?
        </div>
      )}

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {participant.username ? (
            <Link
              href={`/player/${participant.username}`}
              className="font-medium hover:text-accent transition-colors truncate"
            >
              {participant.name}
            </Link>
          ) : (
            <span className="font-medium truncate">{participant.name}</span>
          )}
          {participant.is_winner && (
            <span className="text-yellow-500">👑</span>
          )}
          {participant.is_guest && (
            <Badge variant="outline" className="text-[10px]">Guest</Badge>
          )}
        </div>
        {participant.commander_name && (
          <div className="text-sm text-foreground-muted truncate">
            {participant.commander_name}
          </div>
        )}
        {participant.placement && !participant.is_winner && (
          <div className="text-xs text-foreground-subtle">
            #{participant.placement} place
          </div>
        )}
      </div>

      {/* Avatar */}
      <Avatar
        src={participant.avatar_url}
        fallback={participant.name}
        size="md"
      />
    </div>
  );
}
