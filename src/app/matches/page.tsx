import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRecentMatchCards } from "@/lib/services";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MatchLog } from "@/components/match";

export default async function MatchesPage() {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's matches
  const matchesResult = await getRecentMatchCards(supabase, {
    userId: user.id,
    limit: 100,
  });

  const matches = matchesResult.success ? matchesResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Matches"
          description="Your complete match history"
        />
        <Button asChild>
          <Link href="/matches/new">Log Match</Link>
        </Button>
      </div>
      
      <MatchLog 
        matches={matches}
        showElo
        showFilters
        currentUserId={user.id}
        title="Match History"
        emptyTitle="No matches yet"
        emptyDescription="Log your first match to start tracking your performance"
        emptyAction={
          <Button asChild>
            <Link href="/matches/new">Log Match</Link>
          </Button>
        }
      />
    </div>
  );
}
