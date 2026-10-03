import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationDropdown } from "./notification-dropdown";
import { emitNotificationsChanged } from "@/lib/notification-events";
import type { NotificationWithActor } from "@/types/notification";

const getNotifications = vi.fn();
const getUnseenNotificationCount = vi.fn();
const markNotificationsSeen = vi.fn();

vi.mock("@/lib/supabase/notifications", () => ({
  getNotifications: (...args: unknown[]) => getNotifications(...args),
  getUnseenNotificationCount: (...args: unknown[]) => getUnseenNotificationCount(...args),
  markNotificationsSeen: (...args: unknown[]) => markNotificationsSeen(...args),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

function notification(id: string, overrides: Partial<NotificationWithActor> = {}): NotificationWithActor {
  return {
    id,
    recipientId: "me",
    actorId: "owner",
    type: "friend_accepted",
    entityType: "player",
    entityId: "owner",
    data: { friendship_id: "f1", addressee_id: "owner", addressee_username: "owner", addressee_avatar_url: null },
    readAt: null,
    seenAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-09-30T05:08:55Z",
    actor: { id: "owner", username: "owner", displayName: null, avatarUrl: null },
    ...overrides,
  } as NotificationWithActor;
}

describe("NotificationDropdown", () => {
  beforeEach(() => {
    getNotifications.mockReset();
    getUnseenNotificationCount.mockReset();
    markNotificationsSeen.mockReset().mockResolvedValue({ success: true, data: 1 });
  });

  it("shows a notification that arrives over realtime after mount", async () => {
    const invite = notification("n2", {
      type: "collection_invite",
      data: { collection_id: "c1", collection_name: "Test Collection", owner_id: "owner", owner_username: "owner", owner_avatar_url: null, role: "member" },
    });
    getNotifications.mockResolvedValue({ success: true, data: [invite, notification("n1")] });
    getUnseenNotificationCount.mockResolvedValue({ success: true, data: 2 });

    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={1} userId="me" />);
    act(() => emitNotificationsChanged());

    await waitFor(() => expect(screen.getByLabelText("Notifications (2 new)")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Notifications (2 new)"));
    expect(screen.getByText(/added you to/)).toBeInTheDocument();
  });

  it("marks only the notifications it displayed as seen", async () => {
    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={3} userId="me" />);
    await userEvent.click(screen.getByLabelText("Notifications (3 new)"));
    expect(markNotificationsSeen).toHaveBeenCalledWith(expect.anything(), "me", ["n1"]);
    // Two unseen notifications weren't in the list, so the badge keeps them.
    expect(screen.getByLabelText("Notifications (2 new)")).toBeInTheDocument();
  });

  it("does not call the RPC when nothing displayed is unseen", async () => {
    render(
      <NotificationDropdown
        initialNotifications={[notification("n1", { seenAt: "2026-09-30T05:10:00Z" })]}
        initialUnseenCount={0}
        userId="me"
      />
    );
    await userEvent.click(screen.getByLabelText("Notifications"));
    expect(markNotificationsSeen).not.toHaveBeenCalled();
  });

  it("keeps the current list when a refetch fails", async () => {
    getNotifications.mockResolvedValue({ success: false, error: "network" });
    getUnseenNotificationCount.mockResolvedValue({ success: false, error: "network" });

    render(<NotificationDropdown initialNotifications={[notification("n1")]} initialUnseenCount={1} userId="me" />);
    act(() => emitNotificationsChanged());
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());

    await userEvent.click(screen.getByLabelText("Notifications (1 new)"));
    expect(screen.getByText(/accepted your friend request/)).toBeInTheDocument();
  });
});
