import { PageHeader } from "@/components/layout";
import { CollectionForm } from "@/components/collection";

export default function NewCollectionPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Create Collection"
        description="Start a new collection to track matches with your playgroup"
      />
      <CollectionForm />
    </div>
  );
}
