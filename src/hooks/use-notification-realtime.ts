"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import type { NotificationType } from "@/types/notification";
import { getNotificationTitle } from "@/types/notification";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseNotificationRealtimeOptions {
  userId: string | null;
  onNewNotification?: (notification: RealtimeNotification) => void;
}

type RealtimeNotification = {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  created_at: string;
};

/**
 * Hook to subscribe to real-time notification updates.
 * Shows toast notifications when new notifications arrive.
 */
export function useNotificationRealtime({
  userId,
  onNewNotification,
}: UseNotificationRealtimeOptions) {
  const channelRef = React.useRef<RealtimeChannel | null>(null);

  React.useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Subscribe to notifications for this user
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as RealtimeNotification;
          
          // Show toast notification
          showNotificationToast(notification);
          
          // Call custom handler if provided
          onNewNotification?.(notification);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId, onNewNotification]);
}

/**
 * Show a toast notification based on notification type
 */
function showNotificationToast(notification: RealtimeNotification) {
  const { type, data } = notification;
  
  const title = getNotificationTitle(type);
  const description = getNotificationDescription(type, data);
  
  // Determine toast type based on notification type
  const toastType = getToastType(type);
  
  toast({
    type: toastType,
    title,
    description,
    duration: 6000,
  });
}

function getNotificationDescription(
  type: NotificationType,
  data: Record<string, unknown>
): string | undefined {
  switch (type) {
    case "match_pending_confirmation":
      return data.creator_username
        ? `${data.creator_username} logged a match`
        : "A match needs your confirmation";
    case "match_confirmed":
      if (typeof data.rating_delta === "number") {
        const delta = data.rating_delta;
        return delta > 0 ? `+${delta} rating` : `${delta} rating`;
      }
      return undefined;
    case "friend_request":
      return data.requester_username
        ? `From @${data.requester_username}`
        : undefined;
    case "friend_accepted":
      return data.addressee_username
        ? `@${data.addressee_username} is now your friend`
        : undefined;
    case "collection_invite":
      return data.collection_name
        ? `Join "${data.collection_name}"`
        : undefined;
    case "elo_milestone":
      return data.new_rating
        ? `New rating: ${data.new_rating}`
        : undefined;
    default:
      return undefined;
  }
}

function getToastType(
  type: NotificationType
): "default" | "success" | "error" | "warning" | "info" {
  switch (type) {
    case "match_confirmed":
    case "friend_accepted":
    case "claim_accepted":
    case "elo_milestone":
      return "success";
    case "match_disputed":
      return "warning";
    case "match_pending_confirmation":
    case "friend_request":
    case "collection_invite":
    case "claim_available":
      return "info";
    default:
      return "default";
  }
}
