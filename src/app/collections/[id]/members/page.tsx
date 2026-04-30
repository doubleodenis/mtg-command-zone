import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, Badge } from "@/components/ui";
import { RemoveMemberButton } from "@/components/collection";
import { createClient } from "@/lib/supabase/server";
import { getCollectionWithMembers } from "@/lib/supabase";

// Force dynamic rendering
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionMembersPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch collection with members
  const collectionResult = await getCollectionWithMembers(supabase, id);

  // Layout handles 404 for missing/private collections
  if (!collectionResult.success) {
    return null;
  }

  const collection = collectionResult.data;

  // Check if current user is the owner (for remove button)
  const isOwner = collection.members.some(
    (m) => m.userId === user?.id && m.role === "owner"
  );

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-card-border">
        {collection.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-4 px-4 py-3"
          >
            <Link href={`/player/${member.profile.username}`}>
              <Avatar
                src={member.profile.avatarUrl}
                fallback={member.profile.username}
                size="md"
              />
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={`/player/${member.profile.username}`}
                className="hover:text-accent transition-colors"
              >
                <p className="font-medium text-text-1 truncate">
                  {member.profile.username}
                </p>
              </Link>
              <p className="text-sm text-text-3">
                Joined {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={member.role === "owner" ? "gold" : "outline"}>
                {member.role === "owner" ? "Owner" : "Member"}
              </Badge>

              {isOwner && member.role !== "owner" && (
                <RemoveMemberButton
                  collectionId={id}
                  userId={member.userId}
                  username={member.profile.username}
                />
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
