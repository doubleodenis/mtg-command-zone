"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseFriendRequestRealtimeOptions {
  userId: string | null;
  onNewRequest?: (friendshipId: string, requesterId: string) => void;
}

type RealtimeFriendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
};

/**
 * Hook to subscribe to real-time friend request updates.
 * Shows toast notifications when new friend requests arrive.
 */
export function useFriendRequestRealtime({
  userId,
  onNewRequest,
}: UseFriendRequestRealtimeOptions) {
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  React.useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to friend requests for this user
    const channel = supabase
      .channel(`friend_requests:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friends",
          filter: `addressee_id=eq.${userId}`,
        },
        async (payload) => {
          const friendship = payload.new as RealtimeFriendship;

          // Only notify for pending requests
          if (friendship.status !== "pending") return;

          // Fetch requester profile for toast
          const { data: requester } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", friendship.requester_id)
            .single();

          if (requester) {
            const name = requester.display_name || requester.username;
            toast({
              type: "info",
              title: "New friend request",
              description: `${name} sent you a friend request`,
              duration: 6000,
            });
          }

          // Call custom handler if provided
          onNewRequest?.(friendship.id, friendship.requester_id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, onNewRequest]);
}
