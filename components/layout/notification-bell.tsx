"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "@/lib/actions/notification-actions";
import { NOTIFICATION_TYPE_META } from "@/lib/notification-types";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  /** Current user's role + id — required to enable HR/Admin Realtime
   *  subscription. Other roles still get the on-mount fetch. */
  role?: string | null;
  userId?: string | null;
}

const REALTIME_ROLES = new Set(["hr", "admin"]);

// Types that belong to the "hr_inbox" group surface as toast popups in
// addition to landing in the bell list. Looked up via NOTIFICATION_TYPE_META
// so the source of truth stays in one place.
const HR_INBOX_TYPES = new Set<string>(
  NOTIFICATION_TYPE_META
    .filter((m) => m.group === "hr_inbox")
    .map((m) => m.type),
);

export function NotificationBell({ role, userId }: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Tab title flicker — store original title once so we can restore.
  const originalTitleRef = useRef<string>("");
  const flickerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadNotifications();
    if (typeof document !== "undefined") {
      originalTitleRef.current = document.title;
    }
  }, []);

  function loadNotifications() {
    startTransition(async () => {
      try {
        const data = await getMyNotifications();
        setNotifications(data);
      } catch {
        // Silently fail — user may not have notifications table
      }
    });
  }

  // Real-time subscription — HR/Admin only. Listens for new rows in
  // notifications filtered to this user, prepends them, fires toast for
  // hr_inbox types, and triggers title flicker if the tab is hidden.
  useEffect(() => {
    if (!userId || !role || !REALTIME_ROLES.has(role)) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          if (!newNotif?.id) return;

          // Prepend to state (avoid duplicates if optimistic race)
          setNotifications((prev) => {
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // Toast popup for HR-inbox group only — leave personal alerts
          // to be discovered via the bell dropdown to avoid spam.
          if (HR_INBOX_TYPES.has(newNotif.type)) {
            toast.info(newNotif.message, {
              duration: 6000,
            });
          }

          // Tab title flicker when tab is not visible
          if (typeof document !== "undefined" && document.hidden) {
            startTitleFlicker(newNotif.message);
          }
        },
      )
      .on("system", { event: "SUBSCRIBED" }, () => {
        // After (re)connect, sync state from server — covers
        // notifications missed during disconnect.
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopTitleFlicker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role]);

  // Stop flicker when the tab regains focus
  useEffect(() => {
    if (typeof document === "undefined") return;
    function onVisibility() {
      if (!document.hidden) stopTitleFlicker();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function startTitleFlicker(msg: string) {
    if (typeof document === "undefined") return;
    stopTitleFlicker();
    const original = originalTitleRef.current || document.title;
    const truncated = msg.length > 30 ? msg.slice(0, 30) + "…" : msg;
    let flip = false;
    flickerTimerRef.current = setInterval(() => {
      document.title = flip ? original : `🔔 ${truncated}`;
      flip = !flip;
    }, 1200);
  }

  function stopTitleFlicker() {
    if (flickerTimerRef.current) {
      clearInterval(flickerTimerRef.current);
      flickerTimerRef.current = null;
    }
    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }

  function handleMarkRead(id: string) {
    startTransition(async () => {
      try {
        await markAsRead(id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      } catch { /* ignore */ }
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      try {
        await markAllAsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      } catch { /* ignore */ }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      } catch { /* ignore */ }
    });
  }

  function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "เมื่อสักครู่";
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  }

  return (
    <DropdownMenu open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (isOpen) { loadNotifications(); stopTitleFlicker(); } }}>
      <DropdownMenuTrigger className="relative w-10 h-10 rounded-lg text-foreground/70 hover:bg-muted grid place-items-center" aria-label="Notifications">
        <Bell className="size-[19px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto rounded-xl p-0 shadow-lg border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">การแจ้งเตือน</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="text-xs h-7"
            >
              <Check className="h-3 w-3 mr-1" />
              อ่านทั้งหมด
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="divide-y">
          {notifications.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ไม่มีการแจ้งเตือน
            </div>
          )}
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors ${
                !notif.is_read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!notif.is_read ? "font-medium" : "text-muted-foreground"}`}>
                  {notif.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.created_at)}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {!notif.is_read && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="อ่านแล้ว"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif.id)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="ลบ"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
