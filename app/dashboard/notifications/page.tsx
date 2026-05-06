import { getMyNotifications } from "@/lib/actions/notification-actions";
import { NotificationsClient } from "./notifications-client";

export const metadata = { title: "การแจ้งเตือนทั้งหมด" };

export default async function NotificationsPage() {
  const notifications = await getMyNotifications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">การแจ้งเตือน</h1>
        <p className="text-muted-foreground">รายการแจ้งเตือนทั้งหมดของคุณ</p>
      </div>

      <NotificationsClient initialNotifications={notifications} />
    </div>
  );
}
