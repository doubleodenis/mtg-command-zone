import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { CollectionSettingsForm } from "@/components/collection";
import { createClient } from "@/lib/supabase/server";
import { getCollectionById } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch collection
  const collectionResult = await getCollectionById(supabase, id);

  if (!collectionResult.success) {
    notFound();
  }

  const collection = collectionResult.data;

  // Only owners can access settings
  if (collection.ownerId !== user.id) {
    redirect(`/collections/${id}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Collection Settings"
        description="Manage your collection's name, privacy, and permissions"
      />

      <CollectionSettingsForm collection={collection} />
    </div>
  );
}
