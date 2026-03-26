import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFormatSummaries } from "@/lib/supabase/formats";
import { getActiveDecks } from "@/lib/supabase/decks";
import { PageHeader } from "@/components/layout";
import { MatchForm } from "@/components/match/match-form";

export default async function NewMatchPage() {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch formats and user's decks in parallel
  const [formatsResult, decksResult] = await Promise.all([
    getFormatSummaries(supabase),
    getActiveDecks(supabase, user.id),
  ]);

  const formats = formatsResult.success ? formatsResult.data : [];
  const userDecks = decksResult.success ? decksResult.data : [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Log Match"
        description="Record a new Commander match"
      />
      <MatchForm
        formats={formats}
        currentUserId={user.id}
        currentUserDecks={userDecks}
      />
    </div>
  );
}
