import { PageHeader, TabNav } from "@/components/layout";
import { CollectionForm } from "@/components/collection";
import { AUTHENTICATED_NAV } from "@/lib/nav-config";

export default function NewCollectionPage() {
  return (
    <>
      <TabNav items={AUTHENTICATED_NAV} />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Create Collection"
          description="Start a new collection to track matches with your playgroup"
        />
        <CollectionForm />
      </main>
    </>
  );
}
