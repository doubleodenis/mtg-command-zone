import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, Badge, Button } from "@/components/ui";
import { PageHeader, Section } from "@/components/layout";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import {
  getFriends,
  getIncomingFriendRequests,
  respondToFriendRequest,
} from "@/lib/supabase";
import type { Friend, FriendRequest } from "@/types";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch friends and incoming requests in parallel
  const [friendsResult, requestsResult] = await Promise.all([
    getFriends(supabase, user.id),
    getIncomingFriendRequests(supabase, user.id),
  ]);

  const friends = friendsResult.success ? friendsResult.data : [];
  const incomingRequests = requestsResult.success ? requestsResult.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Friends"
        description="Manage your friends and friend requests"
        actions={
          <Button asChild>
            <Link href="/friends/find">Find Friends</Link>
          </Button>
        }
      />

      {/* Pending Requests */}
      {incomingRequests.length > 0 && (
        <Section title="PENDING REQUESTS">
          <Card>
            <CardContent className="p-0 divide-y divide-card-border">
              {incomingRequests.map((request) => (
                <FriendRequestRow key={request.id} request={request} />
              ))}
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Friends List */}
      <Section title={`YOUR FRIENDS (${friends.length})`}>
        {friends.length > 0 ? (
          <Card>
            <CardContent className="p-0 divide-y divide-card-border">
              {friends.map((friend) => (
                <FriendRow key={friend.id} friend={friend} />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon={<FriendsIcon className="w-8 h-8 text-text-3" />}
                title="No friends yet"
                description="Search for players to add them as friends and see their matches on your feed."
                action={
                  <Button asChild size="sm">
                    <Link href="/friends/find">Find Friends</Link>
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}
      </Section>
    </div>
  );
}

function FriendRow({ friend }: { friend: Friend }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Link href={`/player/${friend.username}`}>
        <Avatar
          src={friend.avatarUrl}
          fallback={friend.username}
          size="md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/player/${friend.username}`}
          className="hover:text-accent transition-colors"
        >
          <p className="font-medium text-text-1 truncate">
            {friend.username}
          </p>
        </Link>
        <p className="text-sm text-text-3">
          Friends since {new Date(friend.friendsSince).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/player/${friend.username}`}>View Profile</Link>
        </Button>
      </div>
    </div>
  );
}

function FriendRequestRow({ request }: { request: FriendRequest }) {
  async function acceptRequest() {
    "use server";
    const supabase = await createClient();
    await respondToFriendRequest(supabase, request.id, "accepted");
    revalidatePath("/friends");
  }

  async function declineRequest() {
    "use server";
    const supabase = await createClient();
    await respondToFriendRequest(supabase, request.id, "blocked");
    revalidatePath("/friends");
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Link href={`/player/${request.from.username}`}>
        <Avatar
          src={request.from.avatarUrl}
          fallback={request.from.username}
          size="md"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/player/${request.from.username}`}
          className="hover:text-accent transition-colors"
        >
          <p className="font-medium text-text-1 truncate">
            {request.from.username}
          </p>
        </Link>
        <p className="text-sm text-text-3">
          Sent {new Date(request.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <form action={acceptRequest}>
          <Button type="submit" size="sm">
            Accept
          </Button>
        </form>
        <form action={declineRequest}>
          <Button type="submit" variant="ghost" size="sm" className="text-text-2">
            Decline
          </Button>
        </form>
      </div>
    </div>
  );
}

function FriendsIcon({ className }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
