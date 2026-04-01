"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { approveClaimRequest, rejectClaimRequest } from "@/app/actions/match";
import { acceptFriendRequest, rejectFriendRequest } from "@/app/actions/friend";
import type { NotificationWithActor, NotificationType, ClaimAvailableData, FriendRequestData } from "@/types/notification";
import { getNotificationTitle, getNotificationUrl } from "@/types/notification";

interface NotificationListProps {
  initialNotifications: NotificationWithActor[];
  userId: string;
}

type FilterType = "all" | "unread" | "matches" | "social";

/**
 * Full notification list with filters and bulk actions.
 */
export function NotificationList({
  initialNotifications,
  userId,
}: NotificationListProps) {
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [filter, setFilter] = React.useState<FilterType>("all");
  const [isMarkingAllRead, setIsMarkingAllRead] = React.useState(false);
  const [claimActionLoading, setClaimActionLoading] = React.useState<string | null>(null);
  const [friendActionLoading, setFriendActionLoading] = React.useState<string | null>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  // Filter notifications
  const filteredNotifications = React.useMemo(() => {
    return notifications.filter((n) => {
      switch (filter) {
        case "unread":
          return !n.readAt;
        case "matches":
          return ["match_pending_confirmation", "match_confirmed", "match_disputed", "match_result_edited"].includes(n.type);
        case "social":
          return ["friend_request", "friend_accepted", "collection_invite", "collection_match_added"].includes(n.type);
        default:
          return true;
      }
    });
  }, [notifications, filter]);

  // Mark notification as read and navigate
  const handleNotificationClick = async (notification: NotificationWithActor) => {
    if (!notification.readAt) {
      // Optimistically mark as read
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );

      const supabase = createClient();
      await supabase.rpc("mark_notifications_read", {
        p_recipient_id: userId,
        p_notification_ids: [notification.id],
      });
    }

    const url = getNotificationUrl(notification);
    router.push(url);
  };

  // Dismiss a single notification
  const handleDismiss = async (notificationId: string) => {
    // Optimistically remove from list
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_id", userId);

    router.refresh();
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    setIsMarkingAllRead(true);
    
    // Optimistically mark all as read
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    );

    const supabase = createClient();
    await supabase.rpc("mark_notifications_read", {
      p_recipient_id: userId,
    });

    setIsMarkingAllRead(false);
    router.refresh();
  };

  // Handle claim approval
  const handleClaimApprove = async (notification: NotificationWithActor) => {
    const data = notification.data as ClaimAvailableData;
    setClaimActionLoading(notification.id);

    const result = await approveClaimRequest(data.participant_id);
    
    if (result.success) {
      // Remove notification and dismiss
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notification.id);
    }
    
    setClaimActionLoading(null);
    router.refresh();
  };

  // Handle claim rejection
  const handleClaimReject = async (notification: NotificationWithActor) => {
    const data = notification.data as ClaimAvailableData;
    setClaimActionLoading(notification.id);

    const result = await rejectClaimRequest(data.participant_id);
    
    if (result.success) {
      // Remove notification and dismiss
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notification.id);
    }
    
    setClaimActionLoading(null);
    router.refresh();
  };

  // Handle friend request acceptance
  const handleFriendAccept = async (notification: NotificationWithActor) => {
    const data = notification.data as FriendRequestData;
    setFriendActionLoading(notification.id);

    const result = await acceptFriendRequest(data.friendship_id);
    
    if (result.success) {
      // Remove notification and dismiss
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notification.id);
    }
    
    setFriendActionLoading(null);
    router.refresh();
  };

  // Handle friend request rejection
  const handleFriendReject = async (notification: NotificationWithActor) => {
    const data = notification.data as FriendRequestData;
    setFriendActionLoading(notification.id);

    const result = await rejectFriendRequest(data.friendship_id);
    
    if (result.success) {
      // Remove notification and dismiss
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      const supabase = createClient();
      await supabase
        .from("notifications")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", notification.id);
    }
    
    setFriendActionLoading(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Filters */}
        <div className="flex items-center gap-2">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
            count={unreadCount}
          >
            Unread
          </FilterButton>
          <FilterButton
            active={filter === "matches"}
            onClick={() => setFilter("matches")}
          >
            Matches
          </FilterButton>
          <FilterButton
            active={filter === "social"}
            onClick={() => setFilter("social")}
          >
            Social
          </FilterButton>
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
          >
            {isMarkingAllRead ? "Marking..." : "Mark all as read"}
          </Button>
        )}
      </div>

      {/* Notification list */}
      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOffIcon className="w-12 h-12 mx-auto mb-4 text-text-3" />
            <p className="text-text-2">
              {filter === "all"
                ? "No notifications yet"
                : `No ${filter === "unread" ? "unread" : filter} notifications`}
            </p>
            <p className="text-sm text-text-3 mt-1">
              When you receive notifications, they'll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-card-border">
            {filteredNotifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                onDismiss={() => handleDismiss(notification.id)}
                onClaimApprove={() => handleClaimApprove(notification)}
                onClaimReject={() => handleClaimReject(notification)}
                isClaimActionLoading={claimActionLoading === notification.id}
                onFriendAccept={() => handleFriendAccept(notification)}
                onFriendReject={() => handleFriendReject(notification)}
                isFriendActionLoading={friendActionLoading === notification.id}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, count, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md transition-colors",
        active
          ? "bg-accent text-white"
          : "text-text-2 hover:text-text-1 hover:bg-surface"
      )}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={cn(
          "ml-1.5 px-1.5 py-0.5 text-xs rounded-full",
          active ? "bg-white/20" : "bg-surface"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

interface NotificationRowProps {
  notification: NotificationWithActor;
  onClick: () => void;
  onDismiss: () => void;
  onClaimApprove: () => void;
  onClaimReject: () => void;
  isClaimActionLoading: boolean;
  onFriendAccept: () => void;
  onFriendReject: () => void;
  isFriendActionLoading: boolean;
}

function NotificationRow({ 
  notification, 
  onClick, 
  onDismiss,
  onClaimApprove,
  onClaimReject,
  isClaimActionLoading,
  onFriendAccept,
  onFriendReject,
  isFriendActionLoading,
}: NotificationRowProps) {
  const isUnread = !notification.readAt;
  const isClaimNotification = notification.type === "claim_available";
  const isFriendRequestNotification = notification.type === "friend_request";
  const hasInlineActions = isClaimNotification || isFriendRequestNotification;

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 p-4 transition-colors",
        !hasInlineActions && "hover:bg-surface/50 cursor-pointer",
        isUnread && "bg-surface/30"
      )}
      onClick={hasInlineActions ? undefined : onClick}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
      )}

      {/* Actor avatar or icon */}
      <div className="shrink-0 ml-2">
        {notification.actor ? (
          <Avatar
            src={notification.actor.avatarUrl}
            fallback={notification.actor.username}
            size="md"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
            <NotificationTypeIcon type={notification.type} className="w-5 h-5 text-text-3" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm",
          isUnread ? "text-text-1" : "text-text-2"
        )}>
          <NotificationMessage notification={notification} />
        </p>
        <p className="text-xs text-text-3 mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
        
        {/* Claim action buttons */}
        {isClaimNotification && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClaimApprove();
              }}
              disabled={isClaimActionLoading}
            >
              {isClaimActionLoading ? "..." : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onClaimReject();
              }}
              disabled={isClaimActionLoading}
            >
              Reject
            </Button>
          </div>
        )}

        {/* Friend request action buttons */}
        {isFriendRequestNotification && (
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onFriendAccept();
              }}
              disabled={isFriendActionLoading}
            >
              {isFriendActionLoading ? "..." : "Accept"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onFriendReject();
              }}
              disabled={isFriendActionLoading}
            >
              Ignore
            </Button>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="shrink-0 p-2 text-text-3 hover:text-text-2 hover:bg-surface rounded transition-colors"
        aria-label="Dismiss notification"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Generate a human-readable message for a notification
 */
function NotificationMessage({ notification }: { notification: NotificationWithActor }) {
  const { type, data, actor } = notification;
  const actorName = actor?.username ?? "Someone";

  switch (type) {
    case "match_pending_confirmation":
      return (
        <>
          <span className="font-medium">{actorName}</span> logged a match that needs your confirmation
        </>
      );
    case "match_confirmed":
      return (
        <>
          A match has been confirmed. {getMatchRatingMessage(data)}
        </>
      );
    case "friend_request":
      return (
        <>
          <span className="font-medium">{actorName}</span> sent you a friend request
        </>
      );
    case "friend_accepted":
      return (
        <>
          <span className="font-medium">{actorName}</span> accepted your friend request
        </>
      );
    case "collection_invite":
      return (
        <>
          <span className="font-medium">{actorName}</span> invited you to join a collection
        </>
      );
    case "collection_match_added":
      return (
        <>
          A match was added to your collection
        </>
      );
    case "claim_available":
      return (
        <>
          <span className="font-medium">{actorName}</span> wants to claim a placeholder slot in your match
        </>
      );
    case "claim_accepted":
      return (
        <>
          Your claim request was approved
        </>
      );
    case "elo_milestone":
      return (
        <>
          You reached a new rating milestone!
        </>
      );
    case "rank_changed":
      return (
        <>
          Your rank has changed
        </>
      );
    default:
      return <>{getNotificationTitle(type)}</>;
  }
}

function getMatchRatingMessage(data: unknown): string {
  if (typeof data === "object" && data !== null && "rating_delta" in data) {
    const delta = (data as { rating_delta: number }).rating_delta;
    if (delta > 0) return `+${delta} rating`;
    if (delta < 0) return `${delta} rating`;
  }
  return "";
}

/**
 * Icon based on notification type
 */
function NotificationTypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  switch (type) {
    case "match_pending_confirmation":
    case "match_confirmed":
      return <MatchIcon className={className} />;
    case "friend_request":
    case "friend_accepted":
      return <UserIcon className={className} />;
    case "collection_invite":
    case "collection_match_added":
      return <CollectionIcon className={className} />;
    case "elo_milestone":
    case "rank_changed":
      return <TrophyIcon className={className} />;
    default:
      return <BellIcon className={className} />;
  }
}

// Icons
function BellIcon({ className }: { className?: string }) {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function BellOffIcon({ className }: { className?: string }) {
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
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="m2 2 20 20" />
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

function MatchIcon({ className }: { className?: string }) {
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
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CollectionIcon({ className }: { className?: string }) {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
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
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
