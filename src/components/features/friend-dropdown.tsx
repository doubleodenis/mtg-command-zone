"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  searchProfiles,
  sendFriendRequest,
  getFriendshipStatus,
  respondToFriendRequest,
  getIncomingFriendRequests,
} from "@/lib/supabase/profiles";
import { acceptFriendRequest, rejectFriendRequest } from "@/app/actions/friend";
import { useFriendRequestRealtime } from "@/hooks/use-friend-request-realtime";
import type { Friend, FriendRequest, ProfileSummary, FriendshipStatus } from "@/types";

interface FriendDropdownProps {
  initialFriends: Friend[];
  initialPendingRequests: FriendRequest[];
  initialPendingCount: number;
  userId: string;
}

type SearchResult = ProfileSummary & {
  friendshipStatus: FriendshipStatus | null;
  isOutgoing: boolean;
  isIncoming: boolean;
  friendshipId: string | null;
};

/**
 * Friend icon with dropdown showing friends, pending requests, and search.
 * Full-screen modal on mobile.
 */
export function FriendDropdown({
  initialFriends,
  initialPendingRequests,
  initialPendingCount,
  userId,
}: FriendDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [friends, setFriends] = React.useState(initialFriends);
  const [pendingRequests, setPendingRequests] = React.useState(initialPendingRequests);
  const [pendingCount, setPendingCount] = React.useState(initialPendingCount);
  const [activeTab, setActiveTab] = React.useState<"friends" | "requests" | "search">(
    initialPendingCount > 0 ? "requests" : "friends"
  );
  const [isMobile, setIsMobile] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Action loading states
  const [acceptingId, setAcceptingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [sendingTo, setSendingTo] = React.useState<string | null>(null);

  // Realtime updates for new friend requests
  useFriendRequestRealtime({
    userId,
    onNewRequest: React.useCallback(async () => {
      // Refetch pending requests when a new one arrives
      const supabase = createClient();
      const result = await getIncomingFriendRequests(supabase, userId);
      if (result.success) {
        setPendingRequests(result.data);
        setPendingCount(result.data.length);
      }
    }, [userId]),
  });

  // Check mobile viewport
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close dropdown when clicking outside (desktop only)
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !isMobile &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen && !isMobile) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, isMobile]);

  // Close dropdown on escape key
  React.useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  // Prevent body scroll on mobile when open
  React.useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, isMobile]);

  const handleOpen = () => {
    setIsOpen(true);
    // Switch to requests tab if there are pending requests
    if (pendingCount > 0) {
      setActiveTab("requests");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  };

  // Accept friend request
  const handleAccept = async (request: FriendRequest) => {
    setAcceptingId(request.id);

    const result = await acceptFriendRequest(request.id);

    if (result.success) {
      // Move from pending to friends
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setPendingCount((prev) => Math.max(0, prev - 1));
      setFriends((prev) => [
        ...prev,
        {
          ...request.from,
          friendshipId: request.id,
          friendsSince: new Date().toISOString(),
        },
      ]);
      router.refresh();
    }

    setAcceptingId(null);
  };

  // Reject friend request
  const handleReject = async (request: FriendRequest) => {
    setRejectingId(request.id);

    const result = await rejectFriendRequest(request.id);

    if (result.success) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
      setPendingCount((prev) => Math.max(0, prev - 1));
      router.refresh();
    }

    setRejectingId(null);
  };

  // Search for users
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

  // Send friend request from search
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

  // Accept from search results (for incoming requests found in search)
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

  const tabs = [
    { id: "friends" as const, label: "Friends", count: friends.length },
    { id: "requests" as const, label: "Requests", count: pendingCount },
    { id: "search" as const, label: "Search", count: null },
  ];

  // Desktop dropdown content
  const dropdownContent = (
    <div
      className={cn(
        isMobile
          ? "fixed inset-0 z-50 bg-bg-surface flex flex-col"
          : cn(
              "absolute right-0 mt-2 w-80 origin-top-right",
              "rounded-lg border border-card-border bg-card shadow-lg",
              "animate-in fade-in-0 zoom-in-95 duration-100",
              "max-h-[70vh] overflow-hidden flex flex-col"
            )
      )}
      role="dialog"
      aria-label="Friends"
    >
      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 border-b border-card-border flex items-center justify-between",
          isMobile && "pt-4"
        )}
      >
        <h3 className="text-ui font-semibold text-text-1">Friends</h3>
        {isMobile && (
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full text-text-2 hover:text-text-1 hover:bg-surface transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-card-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-accent border-b-2 border-accent -mb-px"
                : "text-text-2 hover:text-text-1"
            )}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 px-1.5 py-0.5 text-2xs rounded-full",
                  tab.id === "requests" && pendingCount > 0
                    ? "bg-danger text-white"
                    : "bg-surface text-text-2"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={cn("flex-1 overflow-y-auto", isMobile && "pb-safe")}>
        {/* Friends Tab */}
        {activeTab === "friends" && (
          <div>
            {friends.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-3 text-sm">
                No friends yet. Search to add friends!
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/player/${friend.username}`}
                    onClick={handleClose}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <Avatar
                      src={friend.avatarUrl}
                      fallback={friend.username}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-1 truncate">
                        {friend.displayName || friend.username}
                      </p>
                      {friend.displayName && (
                        <p className="text-2xs text-text-3 truncate">@{friend.username}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div>
            {pendingRequests.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-3 text-sm">
                No pending friend requests
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/player/${request.from.username}`} onClick={handleClose}>
                        <Avatar
                          src={request.from.avatarUrl}
                          fallback={request.from.username}
                          size="sm"
                        />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/player/${request.from.username}`}
                          onClick={handleClose}
                          className="hover:text-accent transition-colors"
                        >
                          <p className="text-sm font-medium text-text-1 truncate">
                            {request.from.displayName || request.from.username}
                          </p>
                        </Link>
                        <p className="text-2xs text-text-3">
                          {formatRelativeTime(request.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 ml-10">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(request)}
                        disabled={acceptingId === request.id || rejectingId === request.id}
                        className="flex-1"
                      >
                        {acceptingId === request.id ? "..." : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request)}
                        disabled={acceptingId === request.id || rejectingId === request.id}
                        className="flex-1"
                      >
                        {rejectingId === request.id ? "..." : "Decline"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
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
                    <Link href={`/player/${result.username}`} onClick={handleClose}>
                      <Avatar
                        src={result.avatarUrl}
                        fallback={result.username}
                        size="sm"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/player/${result.username}`}
                        onClick={handleClose}
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
        )}
      </div>

      {/* Footer - View All */}
      <div className="px-4 py-2 border-t border-card-border">
        <Link
          href="/friends"
          onClick={handleClose}
          className="text-sm text-accent hover:text-accent/80 transition-colors"
        >
          View all friends
        </Link>
      </div>
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        className={cn(
          "cursor-pointer relative p-2 rounded-full transition-colors",
          "text-text-2 hover:text-text-1 hover:bg-surface",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Friends${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`}
      >
        <UsersIcon className="w-5 h-5" />

        {/* Badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-2xs font-bold text-white bg-danger rounded-full">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>

      {/* Dropdown / Modal */}
      {isOpen && dropdownContent}
    </div>
  );
}

// ============================================
// Icons
// ============================================

function UsersIcon({ className }: { className?: string }) {
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

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
