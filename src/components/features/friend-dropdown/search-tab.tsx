"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  searchProfiles,
  sendFriendRequest,
  getFriendshipStatus,
  respondToFriendRequest,
} from "@/lib/supabase/profiles";
import type { SearchTabProps, SearchResult } from "./types";

export function SearchTab({
  userId,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  isSearching,
  setIsSearching,
  hasSearched,
  setHasSearched,
  sendingTo,
  setSendingTo,
  pendingRequests: _pendingRequests,
  setPendingRequests,
  setPendingCount,
  onClose,
}: SearchTabProps) {
  const router = useRouter();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);

    try {
      const supabase = createClient();
      const searchResult = await searchProfiles(supabase, searchQuery.trim(), 10);

      if (searchResult.success) {
        const filteredProfiles = searchResult.data.filter((p) => p.id !== userId);

        const resultsWithStatus = await Promise.all(
          filteredProfiles.map(async (profile) => {
            const statusResult = await getFriendshipStatus(supabase, userId, profile.id);
            const friendship = statusResult.success ? statusResult.data : null;
            return {
              ...profile,
              friendshipStatus: friendship?.status ?? null,
              isOutgoing:
                friendship?.status === "pending" && friendship?.requesterId === userId,
              isIncoming:
                friendship?.status === "pending" && friendship?.addresseeId === userId,
              friendshipId: friendship?.id ?? null,
            };
          })
        );

        setSearchResults(resultsWithStatus);
      }
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  };

  const handleSendRequest = async (addresseeId: string) => {
    setSendingTo(addresseeId);

    try {
      const supabase = createClient();
      const result = await sendFriendRequest(supabase, userId, addresseeId);

      if (result.success) {
        setSearchResults((prev) =>
          prev.map((r) =>
            r.id === addresseeId
              ? { ...r, friendshipStatus: "pending", isOutgoing: true, isIncoming: false }
              : r
          )
        );
        router.refresh();
      }
    } finally {
      setSendingTo(null);
    }
  };

  const handleAcceptFromSearch = async (profile: SearchResult) => {
    if (!profile.friendshipId) return;
    setSendingTo(profile.id);

    try {
      const supabase = createClient();
      const result = await respondToFriendRequest(supabase, profile.friendshipId, "accepted");

      if (result.success) {
        setSearchResults((prev) =>
          prev.map((r) =>
            r.id === profile.id
              ? { ...r, friendshipStatus: "accepted", isOutgoing: false, isIncoming: false }
              : r
          )
        );
        // Also update pending requests if this person was there
        setPendingRequests((prev) => prev.filter((r) => r.from.id !== profile.id));
        setPendingCount((prev) => Math.max(0, prev - 1));
        router.refresh();
      }
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="Search by username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSearching || !searchQuery.trim()}
          className="shrink-0"
        >
          {isSearching ? "..." : "Search"}
        </Button>
      </form>

      {searchResults.length > 0 && (
        <div className="divide-y divide-card-border -mx-4">
          {searchResults.map((result) => (
            <div key={result.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/player/${result.username}`} onClick={onClose}>
                <Avatar
                  src={result.avatarUrl}
                  fallback={result.username}
                  size="sm"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/player/${result.username}`}
                  onClick={onClose}
                  className="hover:text-accent transition-colors"
                >
                  <p className="text-sm font-medium text-text-1 truncate">
                    {result.displayName || result.username}
                  </p>
                </Link>
              </div>
              <div className="shrink-0">
                {result.friendshipStatus === "accepted" ? (
                  <span className="text-sm text-win font-medium">Friends</span>
                ) : result.isOutgoing ? (
                  <span className="text-sm text-text-3">Sent</span>
                ) : result.isIncoming ? (
                  <Button
                    size="sm"
                    onClick={() => handleAcceptFromSearch(result)}
                    disabled={sendingTo === result.id}
                  >
                    {sendingTo === result.id ? "..." : "Accept"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendRequest(result.id)}
                    disabled={sendingTo === result.id}
                  >
                    {sendingTo === result.id ? "..." : "Add"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && hasSearched && !isSearching && (
        <div className="text-center text-text-3 text-sm py-4">
          No users found matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
