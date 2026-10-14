import { requireUser } from "@/lib/authorization";
import { AppHeader } from "@/components/layout/app-header";
import { listNotificationsAction, getUnreadNotificationCountAction } from "@/features/notifications/actions/notification-actions";
import { NotificationsView, type NotificationItem } from "./notifications-view";

export const metadata = {
  title: "Notifications | Slotify",
  description: "View updates, approvals, rejections, and booking alerts for your reservations.",
};

export default async function NotificationsPage() {
  await requireUser();

  const [listRes, countRes] = await Promise.all([
    listNotificationsAction({ page: 1, pageSize: 50 }),
    getUnreadNotificationCountAction(),
  ]);

  const notifications = listRes.success && listRes.data ? (listRes.data.items as unknown as NotificationItem[]) : [];
  const unreadCount = countRes.success ? countRes.data : 0;

  return (
    <>
      <AppHeader
        title="Notifications"
        description="Stay up to date with activity, approvals, and reminders across your reservations."
      />
      <main className="w-full max-w-4xl mx-auto p-6 space-y-6">
        <NotificationsView
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
        />
      </main>
    </>
  );
}

