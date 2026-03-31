"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { NotificationWithActor, NotificationType } from "@/types/notification";
import { getNotificationTitle, getNotificationUrl } from "@/types/notification";

interface NotificationDropdownProps {
  initialNotifications: NotificationWithActor[];
  initialUnseenCount: number;
  userId: string;
}

/**
 * Bell icon with dropdown showing recent notifications.
 */
export function NotificationDropdown({
  initialNotifications,
  initialUnseenCount,
  userId,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [unseenCount, setUnseenCount] = React.useState(initialUnseenCount);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

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

  // Mark notifications as seen when dropdown opens
  const handleOpen = async () => {
    setIsOpen(true);
    
    if (unseenCount > 0) {
      setUnseenCount(0);
      const supabase = createClient();
      await supabase.rpc("mark_notifications_seen", {
        p_recipient_id: userId,
      });
    }
  };

  // Mark notification as read and navigate
  const handleNotificationClick = async (notification: NotificationWithActor) => {
    setIsOpen(false);
    
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
  const handleDismiss = async (
    e: React.MouseEvent,
    notificationId: string
  ) => {
    e.stopPropagation();
    
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

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell trigger */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={cn(
          "relative p-2 rounded-full transition-colors",
          "text-text-2 hover:text-text-1 hover:bg-surface",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Notifications${unseenCount > 0 ? ` (${unseenCount} new)` : ""}`}
      >
        <BellIcon className="w-5 h-5" />
        
        {/* Badge */}
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4.5 h-4.5 px-1 text-2xs font-bold text-white bg-danger rounded-full">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 mt-2 w-80 origin-top-right",
            "rounded-lg border border-card-border bg-card shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            "max-h-[70vh] overflow-hidden flex flex-col"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
            <h3 className="text-ui font-semibold text-text-1">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-2xs text-text-3">{unreadCount} unread</span>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-text-3 text-sm">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-card-border">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                    onDismiss={(e) => handleDismiss(e, notification.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-card-border">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-accent hover:text-accent/80 transition-colors"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: NotificationWithActor;
  onClick: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}

function NotificationItem({ notification, onClick, onDismiss }: NotificationItemProps) {
  const isUnread = !notification.readAt;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full px-4 py-3 text-left transition-colors",
        "hover:bg-surface focus:outline-none focus-visible:bg-surface",
        isUnread && "bg-surface/50"
      )}
      role="menuitem"
    >
      <div className="flex gap-3">
        {/* Actor avatar or icon */}
        <div className="shrink-0">
          {notification.actor ? (
            <Avatar
              src={notification.actor.avatarUrl}
              fallback={notification.actor.username}
              size="sm"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-surface flex items-center justify-center">
              <NotificationTypeIcon type={notification.type} className="w-4 h-4 text-text-3" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm line-clamp-2",
                isUnread ? "text-text-1" : "text-text-2"
              )}>
                <NotificationMessage notification={notification} />
              </p>
              <p className="text-xs text-text-3 mt-0.5">
                {formatRelativeTime(notification.createdAt)}
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={onDismiss}
              className="shrink-0 p-1 text-text-3 hover:text-text-2 transition-colors rounded"
              aria-label="Dismiss notification"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Unread indicator */}
          {isUnread && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
          )}
        </div>
      </div>
    </button>
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
