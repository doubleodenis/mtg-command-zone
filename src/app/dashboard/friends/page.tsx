"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface FriendRequest {
  id: string;
  requester: Friend;
  created_at: string;
}

// Type definitions for query results
type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  requester: Friend | null;
  addressee: Friend | null;
};

type PendingRow = {
  id: string;
  created_at: string;
  requester: Friend | null;
};

type SearchResultRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;
    setUserId(user.id);

    // Get accepted friendships
    const { data: friendships } = await supabase
      .from("friendships")
      .select(`
        id,
        requester_id,
        addressee_id,
        requester:requester_id (id, username, display_name, avatar_url),
        addressee:addressee_id (id, username, display_name, avatar_url)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    const typedFriendships = (friendships || []) as unknown as FriendshipRow[];
    const friendList: Friend[] = [];
    typedFriendships.forEach((f) => {
      const friend = f.requester_id === user.id ? f.addressee : f.requester;
      if (friend) {
        friendList.push(friend);
      }
    });
    setFriends(friendList);

    // Get pending requests (received)
    const { data: pending } = await supabase
      .from("friendships")
      .select(`
        id,
        created_at,
        requester:requester_id (id, username, display_name, avatar_url)
      `)
      .eq("addressee_id", user.id)
      .eq("status", "pending");

    const typedPending = (pending || []) as unknown as PendingRow[];
    setPendingRequests(
      typedPending.filter(p => p.requester).map((p) => ({
        id: p.id,
        requester: p.requester as Friend,
        created_at: p.created_at,
      }))
    );

    // Get sent requests
    const { data: sent } = await supabase
      .from("friendships")
      .select(`
        id,
        created_at,
        requester:addressee_id (id, username, display_name, avatar_url)
      `)
      .eq("requester_id", user.id)
      .eq("status", "pending");

    const typedSent = (sent || []) as unknown as PendingRow[];
    setSentRequests(
      typedSent.filter(s => s.requester).map((s) => ({
        id: s.id,
        requester: s.requester as Friend,
        created_at: s.created_at,
      }))
    );

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", userId)
      .limit(10);

    const typedData = (data || []) as unknown as SearchResultRow[];

    // Filter out existing friends
    const filtered = typedData.filter(
      (u) => !friends.some((f) => f.id === u.id)
    );

    setSearchResults(filtered);
    setIsSearching(false);
  };

  const sendRequest = async (toUserId: string) => {
    const supabase = createClient();

    const { error } = await supabase.from("friendships").insert({
      requester_id: userId,
      addressee_id: toUserId,
    } as never);

    if (!error) {
      setSearchQuery("");
      setSearchResults([]);
      loadFriends();
    }
  };

  const respondToRequest = async (requestId: string, accept: boolean) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("friendships")
      .update({ status: accept ? "accepted" : "declined" } as never)
      .eq("id", requestId);

    if (!error) {
      loadFriends();
    }
  };

  const cancelRequest = async (requestId: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", requestId);

    if (!error) {
      loadFriends();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-foreground-muted">
          Connect with other players to track matches together.
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-surface"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatar_url}
                      fallback={user.display_name || user.username}
                      size="md"
                    />
                    <div>
                      <div className="font-medium">
                        {user.display_name || user.username}
                      </div>
                      <div className="text-sm text-foreground-muted">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => sendRequest(user.id)}>
                    Add Friend
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Friend Requests
              <Badge>{pendingRequests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={request.requester.avatar_url}
                    fallback={request.requester.display_name || request.requester.username}
                    size="md"
                  />
                  <div>
                    <div className="font-medium">
                      {request.requester.display_name || request.requester.username}
                    </div>
                    <div className="text-sm text-foreground-muted">
                      @{request.requester.username}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => respondToRequest(request.id, true)}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => respondToRequest(request.id, false)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sent Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={request.requester.avatar_url}
                    fallback={request.requester.display_name || request.requester.username}
                    size="md"
                  />
                  <div>
                    <div className="font-medium">
                      {request.requester.display_name || request.requester.username}
                    </div>
                    <div className="text-sm text-foreground-muted">
                      @{request.requester.username}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancelRequest(request.id)}
                >
                  Cancel
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Friends ({friends.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {friends.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/player/${friend.username}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                >
                  <Avatar
                    src={friend.avatar_url}
                    fallback={friend.display_name || friend.username}
                    size="md"
                  />
                  <div>
                    <div className="font-medium">
                      {friend.display_name || friend.username}
                    </div>
                    <div className="text-sm text-foreground-muted">
                      @{friend.username}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-foreground-muted">
              <p>No friends yet. Search for players above to add friends!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
