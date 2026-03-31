"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, Button } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { searchProfiles, sendFriendRequest, getFriendshipStatus, respondToFriendRequest } from "@/lib/supabase/profiles";
import type { ProfileSummary, FriendshipStatus, Friendship } from "@/types";

interface FriendSearchProps {
  currentUserId: string;
}

type SearchResult = ProfileSummary & {
  friendshipStatus: FriendshipStatus | null;
  isOutgoing: boolean; // true if current user sent the request
  isIncoming: boolean; // true if the other user sent the request
  friendshipId: string | null;
};

export function FriendSearch({ currentUserId }: FriendSearchProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [sendingTo, setSendingTo] = React.useState<string | null>(null);
  const [acceptingFrom, setAcceptingFrom] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      const supabase = createClient();
      const searchResult = await searchProfiles(supabase, query.trim(), 20);

      if (!searchResult.success) {
        throw new Error(searchResult.error);
      }

      // Filter out current user and get friendship status for each result
      const filteredProfiles = searchResult.data.filter(
        (p) => p.id !== currentUserId
      );

      const resultsWithStatus = await Promise.all(
        filteredProfiles.map(async (profile) => {
          const statusResult = await getFriendshipStatus(
            supabase,
            currentUserId,
            profile.id
          );
          const friendship = statusResult.success ? statusResult.data : null;
          return {
            ...profile,
            friendshipStatus: friendship?.status ?? null,
            isOutgoing: friendship?.status === "pending" && friendship?.requesterId === currentUserId,
            isIncoming: friendship?.status === "pending" && friendship?.addresseeId === currentUserId,
            friendshipId: friendship?.id ?? null,
          };
        })
      );

      setResults(resultsWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (addresseeId: string) => {
    setSendingTo(addresseeId);
    setError(null);

    try {
      const supabase = createClient();
      const result = await sendFriendRequest(supabase, currentUserId, addresseeId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update the local state to show pending
      setResults((prev) =>
        prev.map((r) =>
          r.id === addresseeId
            ? { ...r, friendshipStatus: "pending", isOutgoing: true, isIncoming: false }
            : r
        )
      );

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSendingTo(null);
    }
  };

  const handleAcceptRequest = async (profileId: string, friendshipId: string) => {
    setAcceptingFrom(profileId);
    setError(null);

    try {
      const supabase = createClient();
      const result = await respondToFriendRequest(supabase, friendshipId, "accepted");

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update the local state to show accepted
      setResults((prev) =>
        prev.map((r) =>
          r.id === profileId
            ? { ...r, friendshipStatus: "accepted", isOutgoing: false, isIncoming: false }
            : r
        )
      );

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setAcceptingFrom(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          type="text"
          placeholder="Search by username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-loss-subtle border border-loss-ring">
          <p className="text-loss text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y divide-card-border">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <Link href={`/player/${result.username}`}>
                  <Avatar
                    src={result.avatarUrl}
                    fallback={result.username}
                    size="md"
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/player/${result.username}`}
                    className="hover:text-accent transition-colors"
                  >
                    <p className="font-medium text-text-1 truncate">
                      {result.username}
                    </p>
                  </Link>
                </div>

                <div className="flex items-center gap-2">
                  {result.friendshipStatus === "accepted" ? (
                    <span className="text-sm text-win font-medium">Friends</span>
                  ) : result.isOutgoing ? (
                    <span className="text-sm text-text-2">Request Sent</span>
                  ) : result.isIncoming && result.friendshipId ? (
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(result.id, result.friendshipId!)}
                      disabled={acceptingFrom === result.id}
                    >
                      {acceptingFrom === result.id ? "Accepting..." : "Accept Request"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleSendRequest(result.id)}
                      disabled={sendingTo === result.id}
                    >
                      {sendingTo === result.id ? "Sending..." : "Add Friend"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state after search */}
      {query && results.length === 0 && !isSearching && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-2">No users found matching "{query}"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
