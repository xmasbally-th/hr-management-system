import { Suspense } from "react";
import { getMyNotifications } from "@/lib/actions/notification-actions";
import { NotificationsClient } from "./notifications-client";
import NotificationsLoading from "./loading";

export const metadata = { title: "การแจ้งเตือนทั้งหมด" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsLoading />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
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
