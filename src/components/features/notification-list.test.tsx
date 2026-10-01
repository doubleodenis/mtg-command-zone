import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { NotificationList } from "./notification-list";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notification-events";
import type { NotificationWithActor } from "@/types/notification";

const markNotificationsSeen = vi.fn().mockResolvedValue({ success: true, data: 1 });

vi.mock("@/lib/supabase/notifications", () => ({
  markNotificationsSeen: (...args: unknown[]) => markNotificationsSeen(...args),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/match", () => ({ approveClaimRequest: vi.fn(), rejectClaimRequest: vi.fn() }));
vi.mock("@/app/actions/friend", () => ({ acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn() }));

function notification(id: string, seenAt: string | null): NotificationWithActor {
  return {
    id,
    recipientId: "me",
    actorId: "owner",
    type: "friend_accepted",
    entityType: "player",
    entityId: "owner",
    data: { friendship_id: "f1", addressee_id: "owner", addressee_username: "owner", addressee_avatar_url: null },
    readAt: null,
    seenAt,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-09-30T05:08:55Z",
    actor: { id: "owner", username: "owner", displayName: null, avatarUrl: null },
  };
}

describe("NotificationList", () => {
  it("marks the unseen notifications it renders as seen", () => {
    render(
      <NotificationList
        initialNotifications={[notification("n1", null), notification("n2", "2026-09-30T06:00:00Z"), notification("n3", null)]}
        userId="me"
      />
    );
    expect(markNotificationsSeen).toHaveBeenCalledWith(expect.anything(), "me", ["n1", "n3"]);
  });

  it("tells the navbar badge to refresh once the backlog is marked seen", async () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    render(<NotificationList initialNotifications={[notification("n1", null)]} userId="me" />);
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  });

  it("does not signal the badge when marking seen fails", async () => {
    markNotificationsSeen.mockResolvedValueOnce({ success: false, error: "PGRST202" });
    const listener = vi.fn();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
    render(<NotificationList initialNotifications={[notification("n1", null)]} userId="me" />);
    await waitFor(() => expect(markNotificationsSeen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener);
  });
});
