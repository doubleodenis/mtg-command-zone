import { PageHeader } from "@/components/layout";
import { DeckForm } from "@/components/deck";

export default function NewDeckPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Add Deck"
        description="Add a new Commander deck to your collection"
      />
      <DeckForm />
    </div>
  );
}
