import { notFound } from "next/navigation";
import { SubNav } from "@/components/layout";
import { CollectionHeader } from "@/components/collection";
import { createClient } from "@/lib/supabase/server";
import { getCollectionWithMembers, isCollectionMember } from "@/lib/supabase";
import { getCollectionNavItems } from "@/lib/nav-config";

interface CollectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function CollectionLayout({
  children,
  params,
}: CollectionLayoutProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch collection with members
  const collectionResult = await getCollectionWithMembers(supabase, id);

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

  const isOwner = collection.members.some(
    (m) => m.userId === user?.id && m.role === "owner"
  );
  const currentMemberIds = collection.members.map((m) => m.userId);
  const navItems = getCollectionNavItems(id);

  return (
    <main className="max-w-6xl md:mx-auto px-4 py-8 space-y-6">
      <CollectionHeader
        collection={{
          id: collection.id,
          name: collection.name,
          description: collection.description,
          isPublic: collection.isPublic,
        }}
        isMember={isMember}
        isOwner={isOwner}
        currentMemberIds={currentMemberIds}
      />
      <SubNav items={navItems} />
      {children}
    </main>
  );
}
