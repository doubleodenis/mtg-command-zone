import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { DeckForm } from "@/components/deck";
import { createClient } from "@/lib/supabase/server";
import { getDeckWithStats } from "@/lib/supabase";

interface EditDeckPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDeckPage({ params }: EditDeckPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the deck
  const result = await getDeckWithStats(supabase, id);

  if (!result.success) {
    console.error("Failed to fetch deck:", result.error);
    notFound();
  }

  const deck = result.data;

  // Verify ownership
  if (deck.ownerId !== user.id) {
    redirect("/decks");
  }

  // Determine if deck has been used in matches (locks editing)
  const hasMatches = deck.stats.gamesPlayed > 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Edit Deck"
        description={`Editing "${deck.deckName || deck.commanderName}"`}
      />
      <DeckForm
        deck={deck}
        hasMatches={hasMatches}
        isActive={deck.isActive}
      />
    </div>
  );
}
