import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, calculateWinRate } from "@/lib/utils";

// Type definitions
type DashboardProfile = {
  username: string;
  display_name: string | null;
};

type MatchParticipation = {
  is_winner: boolean;
  commander_name: string | null;
  match: {
    id: string;
    format: string;
    date_played: string;
  } | null;
};

type FriendRequest = {
  id: string;
  requester: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  created_at: string;
};

async function getDashboardData(userId: string) {
  const supabase = await createClient();

  // Get user's recent matches
  const { data: participations } = await supabase
    .from("match_participants")
    .select(`
      is_winner,
      commander_name,
      match:match_id (
        id,
        format,
        date_played
      )
    `)
    .eq("user_id", userId)
    .order("match(date_played)", { ascending: false })
    .limit(10);

  // Get pending friend requests
  const { data: pendingRequests } = await supabase
    .from("friendships")
    .select(`
      id,
      requester:requester_id (username, display_name, avatar_url),
      created_at
    `)
    .eq("addressee_id", userId)
    .eq("status", "pending");

  // Get friend count
  const { count: friendCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq("status", "accepted");

  // Get commander count
  const { count: commanderCount } = await supabase
    .from("user_commanders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Calculate stats
  const matches = (participations || []) as unknown as MatchParticipation[];
  const wins = matches.filter((m) => m.is_winner).length;
  const totalMatches = matches.length;

  return {
    recentMatches: matches,
    pendingRequests: (pendingRequests || []) as unknown as FriendRequest[],
    friendCount: friendCount || 0,
    commanderCount: commanderCount || 0,
    wins,
    totalMatches,
    winRate: calculateWinRate(wins, totalMatches),
  };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .single();

  const profile = profileData as DashboardProfile | null;
  const data = await getDashboardData(user.id);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {profile?.display_name || profile?.username || "Commander"}!
        </h1>
        <p className="text-foreground-muted">
          Here&apos;s what&apos;s happening with your matches.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link href="/dashboard/matches/new">
          <Button>
            <span className="mr-2">⚔️</span>
            Record New Match
          </Button>
        </Link>
        <Link href="/dashboard/commanders">
          <Button variant="secondary">
            <span className="mr-2">👑</span>
            Manage Commanders
          </Button>
        </Link>
        <Link href="/dashboard/friends">
          <Button variant="secondary">
            <span className="mr-2">👥</span>
            Find Friends
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-accent">{data.winRate}%</div>
            <div className="text-sm text-foreground-muted">Win Rate</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{data.totalMatches}</div>
            <div className="text-sm text-foreground-muted">Matches Played</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{data.friendCount}</div>
            <div className="text-sm text-foreground-muted">Friends</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{data.commanderCount}</div>
            <div className="text-sm text-foreground-muted">Commanders</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Matches
              <Link href={`/player/${profile?.username}`}>
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentMatches.length > 0 ? (
              data.recentMatches.slice(0, 5).map((m) => {
                const match = m.match as { id: string; format: string; date_played: string };
                return (
                  <Link
                    key={match.id}
                    href={`/match/${match.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={m.is_winner ? "win" : "loss"}>
                        {m.is_winner ? "WIN" : "LOSS"}
                      </Badge>
                      <div>
                        <div className="text-sm font-medium">{match.format} Commander</div>
                        {m.commander_name && (
                          <div className="text-xs text-foreground-muted">{m.commander_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {formatRelativeTime(match.date_played)}
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="text-center py-8 text-foreground-muted">
                <p className="mb-4">No matches recorded yet.</p>
                <Link href="/dashboard/matches/new">
                  <Button>Record Your First Match</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Friend Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Friend Requests
              {data.pendingRequests.length > 0 && (
                <Badge>{data.pendingRequests.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.pendingRequests.length > 0 ? (
              data.pendingRequests.map((request) => {
                const requester = request.requester as {
                  username: string;
                  display_name: string | null;
                  avatar_url: string | null;
                };
                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-surface-hover flex items-center justify-center text-foreground-muted">
                        {requester.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">
                          {requester.display_name || requester.username}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          @{requester.username}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm">Accept</Button>
                      <Button size="sm" variant="ghost">Decline</Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-foreground-muted">
                <p>No pending friend requests.</p>
                <Link href="/dashboard/friends" className="text-accent hover:underline text-sm">
                  Find friends to add
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
