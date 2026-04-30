import Link from "next/link";
import { Button } from "@/components/ui";
import { MatchLog } from "@/components/match";
import { createClient } from "@/lib/supabase/server";
import { isCollectionMember } from "@/lib/supabase";
import { getRecentMatchCards } from "@/lib/services";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionMatchesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check membership for showElo
  let isMember = false;
  if (user) {
    const memberResult = await isCollectionMember(supabase, id, user.id);
    isMember = memberResult.success && memberResult.data === true;
  }

  // Fetch matches for this collection
  const matchesResult = await getRecentMatchCards(supabase, {
    limit: 100,
    collectionId: id,
    viewerUserId: user?.id,
  });
  
  const matches = matchesResult.success ? matchesResult.data : [];

  return (
    <MatchLog
      matches={matches}
      groupByDate
      showElo={isMember}
      emptyTitle="No matches yet"
      emptyDescription="Be the first to log a match in this collection"
      emptyAction={
        isMember ? (
          <Button size="sm" asChild>
            <Link href="/matches/new">Log Match</Link>
          </Button>
        ) : undefined
      }
    />
  );
}
