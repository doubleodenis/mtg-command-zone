import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { MatchLog } from "@/components/match";
import { createClient } from "@/lib/supabase/server";
import {
  getCollectionById,
  isCollectionMember,
} from "@/lib/supabase";
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

  // Fetch collection
  const collectionResult = await getCollectionById(supabase, id);
  
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

  // If collection is private and user is not a member, return 404
  if (!collection.isPublic && !isMember) {
    notFound();
  }

  // Fetch matches for this collection
  const matchesResult = await getRecentMatchCards(supabase, {
    limit: 100,
    collectionId: id,
  });
  
  const matches = matchesResult.success ? matchesResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Match History"
        description="All matches logged in this collection"
        actions={
          isMember ? (
            <Button asChild>
              <Link href="/matches/new">Log Match</Link>
            </Button>
          ) : null
        }
      />

      <MatchLog
        matches={matches}
        groupByDate
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
    </div>
  );
}
