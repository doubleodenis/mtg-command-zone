import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, Avatar, Button } from "@/components/ui";
import { PageHeader, Section } from "@/components/layout";
import { MatchLog } from "@/components/match";
import { PendingMatchApprovals } from "@/components/collection";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { TopCommandersList } from "@/components/features/top-commanders-list";
import { DashboardStatCard } from "@/components/features/dashboard-stat-card";
import { createClient } from "@/lib/supabase/server";
import {
  getCollectionWithMembers,
  isCollectionMember,
  getLeaderboard,
  getFormats,
  getPendingMatchApprovalsWithDetails,
} from "@/lib/supabase";
import { getRecentMatchCards, getTopCommanders } from "@/lib/services";
import type { CollectionMemberWithProfile, PendingMatchApproval } from "@/types";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch collection data
  const collectionResult = await getCollectionWithMembers(supabase, id);

  if (!collectionResult.success) {
    notFound();
  }

  const collection = collectionResult.data;

  // Check membership
  let isMember = false;
  if (user) {
    const memberResult = await isCollectionMember(supabase, id, user.id);
    isMember = memberResult.success && memberResult.data === true;
  }

  const isOwner = collection.members.some(
    (m) => m.userId === user?.id && m.role === "owner"
  );

  // If collection is private and user is not a member, return 404
  if (!collection.isPublic && !isMember) {
    notFound();
  }

  // Fetch additional data in parallel
  const [formatsResult, matchesResult, commandersResult] = await Promise.all([
    getFormats(supabase),
    getRecentMatchCards(supabase, { limit: 8, collectionId: id, viewerUserId: user?.id }),
    getTopCommanders(supabase, { limit: 5, collectionId: id }),
  ]);

  // Get FFA format for leaderboard (collections typically use FFA)
  const ffaFormat = formatsResult.success
    ? formatsResult.data.find((f) => f.slug === "ffa")
    : null;

  const leaderboardResult = ffaFormat
    ? await getLeaderboard(supabase, ffaFormat.id, 10, id)
    : { success: false as const, error: "No format found" };

  const leaderboard = leaderboardResult.success ? leaderboardResult.data : [];
  const recentMatches = matchesResult.success ? matchesResult.data : [];
  const topCommanders = commandersResult.success ? commandersResult.data : [];

  // Fetch pending approvals if owner and collection requires approval
  let pendingApprovals: PendingMatchApproval[] = [];
  const showPendingApprovals = isOwner && collection.matchAddPermission === "any_member_approval_required";
  
  if (showPendingApprovals) {
    const pendingResult = await getPendingMatchApprovalsWithDetails(supabase, id);
    if (pendingResult.success) {
      pendingApprovals = pendingResult.data;
    }
  }

  // Get top commander by win rate
  const topCommander = topCommanders.length > 0 ? topCommanders[0] : null;
  
  // Get highest win rate player from leaderboard
  const topWinRatePlayer = leaderboard.length > 0 
    ? leaderboard.reduce((best, entry) => entry.winRate > best.winRate ? entry : best, leaderboard[0])
    : null;

  return (
    <div className="space-y-8">
      {/* Collection Header */}
      <CollectionHeader
        collection={collection}
        matchCount={recentMatches.length}
        isMember={isMember}
        isOwner={isOwner}
      />

      {/* Pending Approvals (owner only) */}
      {showPendingApprovals && pendingApprovals.length > 0 && (
        <PendingMatchApprovals
          collectionId={id}
          initialPendingMatches={pendingApprovals}
        />
      )}

      {/* Quick Stats */}
      <Section title="COLLECTION STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardStatCard
            label="Total Matches"
            value={recentMatches.length.toString()}
          />
          <DashboardStatCard
            label="Members"
            value={collection.members.length.toString()}
          />
          <DashboardStatCard
            label="Top Commander WR"
            value={topCommander ? `${topCommander.stats?.winRate ?? 0}%` : 'N/A'}
            sublabel={topCommander ? topCommander.commanderName : undefined}
          />
          <DashboardStatCard
            label="Highest Win Rate"
            value={topWinRatePlayer ? `${topWinRatePlayer.winRate}%` : 'N/A'}
            sublabel={topWinRatePlayer?.username}
          />
        </div>
      </Section>

      {/* Leaderboard Preview */}
      <Section
        title="LEADERBOARD"
        action={
          <Link
            href={`/collections/${id}/leaderboard`}
            className="text-sm text-accent hover:text-accent-fill transition-colors"
          >
            View Full
          </Link>
        }
      >
        <Card>
          <CardContent className="p-0">
            <LeaderboardWithFilter entries={leaderboard} />
          </CardContent>
        </Card>
      </Section>

      {/* Recent Matches */}
      <Section
        title="RECENT MATCHES"
        action={
          <Link
            href={`/collections/${id}/matches`}
            className="text-sm text-accent hover:text-accent-fill transition-colors"
          >
            View All
          </Link>
        }
      >
        <MatchLog
          matches={recentMatches.slice(0, 5)}
          groupByDate
          showElo={!!user && isMember}
        />
      </Section>

      {/* Top Commanders */}
      <Section title="TOP COMMANDERS">
        <Card>
          <CardContent className="p-0">
            <TopCommandersList commanders={topCommanders} />
          </CardContent>
        </Card>
      </Section>

      {/* Members */}
      <Section
        title="MEMBERS"
        action={
          isOwner ? (
            <Link
              href={`/collections/${id}/members`}
              className="text-sm text-accent hover:text-accent-fill transition-colors"
            >
              Manage
            </Link>
          ) : null
        }
      >
        <MembersList members={collection.members} />
      </Section>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

type CollectionHeaderProps = {
  collection: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    matchAddPermission: string;
  };
  matchCount: number;
  isMember: boolean;
  isOwner: boolean;
};

function CollectionHeader({
  collection,
  matchCount,
  isMember,
  isOwner,
}: CollectionHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold text-text-1">
            {collection.name}
          </h1>
          <Badge variant={collection.isPublic ? "outline" : "default"}>
            {collection.isPublic ? "Public" : "Private"}
          </Badge>
        </div>
        {collection.description && (
          <p className="text-text-2 max-w-2xl">{collection.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isMember ? (
          <Button size="sm" asChild>
            <Link href="/matches/new">Log Match</Link>
          </Button>
        ) : (
          <Button size="sm">Request to Join</Button>
        )}
      </div>
    </div>
  );
}

function MembersList({ members }: { members: CollectionMemberWithProfile[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {members.map((member) => (
            <Link
              key={member.id}
              href={`/player/${member.profile.username}`}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-surface transition-colors"
            >
              <Avatar
                src={member.profile.avatarUrl}
                fallback={member.profile.username}
                size="lg"
              />
              <div className="text-center">
                <p className="text-sm font-medium text-text-1 truncate max-w-full">
                  {member.profile.username}
                </p>
                {member.role === "owner" && (
                  <Badge variant="gold" className="mt-1 text-xs">
                    Owner
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
