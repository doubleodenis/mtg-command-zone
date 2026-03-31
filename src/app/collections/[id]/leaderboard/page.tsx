import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { createClient } from "@/lib/supabase/server";
import {
  getCollectionById,
  isCollectionMember,
  getLeaderboard,
  getFormats,
} from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionLeaderboardPage({ params }: PageProps) {
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

  // Get FFA format (collections typically track FFA ratings)
  const formatsResult = await getFormats(supabase);
  const ffaFormat = formatsResult.success
    ? formatsResult.data.find((f) => f.slug === "ffa")
    : null;

  // Fetch leaderboard for this collection
  const leaderboardResult = ffaFormat
    ? await getLeaderboard(supabase, ffaFormat.id, 50, id)
    : { success: false as const, error: "No format found" };

  const leaderboard = leaderboardResult.success ? leaderboardResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="Rankings based on matches within this collection"
      />

      <Card>
        <CardContent className="p-0">
          <LeaderboardWithFilter entries={leaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}
