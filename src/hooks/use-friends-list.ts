"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFriends } from "@/lib/supabase/profiles";

/**
 * Friend data returned by the hook
 */
export interface FriendData {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  friendshipStatus: "accepted";
  isFriend: true;
}

interface UseFriendsListReturn {
  /** List of friends */
  friends: FriendData[];
  /** Whether the friends list is currently loading */
  isLoading: boolean;
  /** Whether friends have been loaded at least once */
  isLoaded: boolean;
  /** Manually trigger a reload of the friends list */
  reload: () => Promise<void>;
}

/**
 * Hook to fetch and cache the current user's friends list.
 * Friends are loaded lazily - call loadFriends() or pass loadOnMount=true.
 *
 * @param userId - The current user's ID
 * @param options.loadOnMount - Whether to load friends immediately on mount (default: false)
 *
 * @example
 * // Load friends when dropdown opens
 * const { friends, isLoading, isLoaded, reload } = useFriendsList(userId);
 *
 * useEffect(() => {
 *   if (isDropdownOpen && !isLoaded) {
 *     reload();
 *   }
 * }, [isDropdownOpen, isLoaded, reload]);
 */
export function useFriendsList(
  userId: string,
  options: { loadOnMount?: boolean } = {}
): UseFriendsListReturn {
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadFriends = useCallback(async () => {
    if (isLoading) return; // Prevent duplicate requests

    setIsLoading(true);
    try {
      const supabase = createClient();
      const result = await getFriends(supabase, userId);

      if (result.success) {
        const friendData: FriendData[] = result.data.map((f) => ({
          id: f.id,
          username: f.username,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          friendshipStatus: "accepted" as const,
          isFriend: true as const,
        }));
        setFriends(friendData);
      }
    } catch (error) {
      console.error("Failed to load friends:", error);
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, [userId, isLoading]);

  // Load on mount if requested
  useEffect(() => {
    if (options.loadOnMount && !isLoaded) {
      loadFriends();
    }
  }, [options.loadOnMount, isLoaded, loadFriends]);

  return {
    friends,
    isLoading,
    isLoaded,
    reload: loadFriends,
  };
}
