import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNotifications } from "@/lib/supabase/notifications";
import { PageHeader } from "@/components/layout";
import { NotificationList } from "@/components/features/notification-list";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const notificationsResult = await getNotifications(supabase, user.id, {
    limit: 50,
    includeRead: true,
    includeDismissed: false,
  });

  const notifications = notificationsResult.success ? notificationsResult.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated on matches, friend requests, and more"
      />

      <NotificationList
        initialNotifications={notifications}
        userId={user.id}
      />
    </div>
  );
}
