import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, Button, Badge } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DeckCard } from "@/components/deck";
import { createClient } from "@/lib/supabase/server";
import { getUserDecksWithStats } from "@/lib/supabase";

export default async function DecksPage() {
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's decks with stats
  const result = await getUserDecksWithStats(supabase, user.id);

  if (!result.success) {
    console.error("Failed to fetch decks:", result.error);
  }

  const decks = result.success ? result.data : [];
  const activeDecks = decks.filter((d) => d.isActive);
  const retiredDecks = decks.filter((d) => !d.isActive);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Decks"
        description="Manage your Commander decks and track their performance"
        actions={
          <Button asChild>
            <Link href="/decks/new">Add Deck</Link>
          </Button>
        }
      />

      {decks.length > 0 ? (
        <>
          {/* Active Decks Section */}
          {activeDecks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-label text-accent">Active Decks</h2>
                <Badge variant="default">{activeDecks.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeDecks.map((deck) => (
                  <DeckCard key={deck.id} deck={deck} />
                ))}
              </div>
            </section>
          )}

          {/* Retired Decks Section */}
          {retiredDecks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-label text-text-2">Retired Decks</h2>
                <Badge variant="default">{retiredDecks.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {retiredDecks.map((deck) => (
                  <DeckCard key={deck.id} deck={deck} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-surface flex items-center justify-center">
                <DeckIcon className="w-8 h-8 text-text-3" />
              </div>
              <div>
                <h3 className="text-lg font-display font-semibold text-text-1 mb-1">
                  No decks yet
                </h3>
                <p className="text-text-2 max-w-sm mx-auto">
                  Add your Commander decks to track their performance, win rates,
                  and see how different brackets affect your rating.
                </p>
              </div>
              <Button asChild>
                <Link href="/decks/new">Add Your First Deck</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="7" height="14" rx="1" />
      <rect x="10" y="3" width="7" height="14" rx="1" />
      <rect x="14" y="5" width="7" height="14" rx="1" />
    </svg>
  );
}
