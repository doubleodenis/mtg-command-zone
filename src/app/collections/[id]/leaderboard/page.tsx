import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardWithFilter } from "@/components/features/leaderboard-with-filter";
import { createClient } from "@/lib/supabase/server";
import { getLeaderboardData } from "@/lib/services";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionLeaderboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const leaderboardResult = await getLeaderboardData(supabase, {
    collectionId: id,
    limitPerFormat: 100,
  });

  const leaderboard = leaderboardResult.success ? leaderboardResult.data.entries : [];

  return (
    <Card>
      <CardContent className="p-0">
        <LeaderboardWithFilter entries={leaderboard} />
      </CardContent>
    </Card>
  );
}
