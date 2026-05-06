"use client";

import { useState, useTransition } from "react";
import { markAsRead, markAllAsRead, deleteNotification } from "@/lib/actions/notification-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trash2, Bell } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const typeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  leave_approved: { label: "ลา - อนุมัติ", variant: "default" },
  leave_rejected: { label: "ลา - ไม่อนุมัติ", variant: "destructive" },
  travel_approved: { label: "เดินทาง - อนุมัติ", variant: "default" },
  travel_rejected: { label: "เดินทาง - ไม่อนุมัติ", variant: "destructive" },
  new_leave_request: { label: "คำขอลาใหม่", variant: "secondary" },
  new_travel_request: { label: "คำขอเดินทางใหม่", variant: "secondary" },
};

export function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleMarkRead(id: string) {
    startTransition(async () => {
      await markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isPending}>
            <Check className="h-4 w-4 mr-2" />
            อ่านทั้งหมด ({unreadCount})
          </Button>
        </div>
      )}

      {/* List */}
      <div className="border rounded-lg bg-card divide-y">
        {notifications.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">ไม่มีการแจ้งเตือน</p>
          </div>
        )}
        {notifications.map((notif) => {
          const typeInfo = typeLabels[notif.type] ?? { label: notif.type, variant: "outline" as const };
          return (
            <div
              key={notif.id}
              className={`flex items-start gap-4 px-4 py-3 ${!notif.is_read ? "bg-primary/5" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={typeInfo.variant} className="text-xs">{typeInfo.label}</Badge>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                  )}
                </div>
                <p className={`text-sm ${!notif.is_read ? "font-medium" : "text-muted-foreground"}`}>
                  {notif.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(notif.created_at).toLocaleString("th-TH")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!notif.is_read && (
                  <Button variant="ghost" size="icon" onClick={() => handleMarkRead(notif.id)} disabled={isPending} className="h-8 w-8">
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(notif.id)} disabled={isPending} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
