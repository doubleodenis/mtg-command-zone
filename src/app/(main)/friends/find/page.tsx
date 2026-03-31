import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { createClient } from "@/lib/supabase/server";
import { FriendSearch } from "../friend-search";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function FindFriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Find Friends"
        description="Search for players to add as friends"
      />
      <FriendSearch currentUserId={user.id} />
    </div>
  );
}
