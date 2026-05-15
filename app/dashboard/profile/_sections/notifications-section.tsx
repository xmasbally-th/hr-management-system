"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyNotificationPrefs } from "@/lib/actions/notification-actions";
import {
  NOTIFICATION_TYPE_META,
  type NotificationType,
} from "@/lib/notification-types";
import { Button } from "@/components/ui/button";
import { Loader2, Save, RotateCcw, Bell, Calendar, Plane, UserCog } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  initialPrefs: Record<NotificationType, boolean>;
}

const GROUP_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  leave: { label: "การลา", icon: Calendar },
  travel: { label: "การเดินทาง", icon: Plane },
  account: { label: "บัญชี", icon: UserCog },
};

export function NotificationsSection({ initialPrefs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean>>(initialPrefs);

  function toggle(t: NotificationType) {
    setPrefs((prev) => ({ ...prev, [t]: !prev[t] }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateMyNotificationPrefs(prefs);
        toast.success("บันทึกการตั้งค่าแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleReset() {
    const allOn = {} as Record<NotificationType, boolean>;
    for (const m of NOTIFICATION_TYPE_META) allOn[m.type] = true;
    setPrefs(allOn);
  }

  // Group by category
  const grouped = NOTIFICATION_TYPE_META.reduce<
    Record<string, typeof NOTIFICATION_TYPE_META>
  >((acc, m) => {
    (acc[m.group] ||= []).push(m);
    return acc;
  }, {});

  const enabledCount = Object.values(prefs).filter(Boolean).length;
  const totalCount = NOTIFICATION_TYPE_META.length;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-start gap-3">
        <Bell className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="text-xs text-muted-foreground">
          เปิด/ปิดการแจ้งเตือนแต่ละประเภทตามที่คุณต้องการ —
          เมื่อปิดจะไม่ปรากฏใน bell icon และไม่ส่งอีเมล (ในอนาคต)
          <br />
          ขณะนี้เปิดอยู่ <span className="font-mono font-semibold text-foreground">{enabledCount}</span>{" "}
          / {totalCount} ประเภท
        </div>
      </div>

      {Object.entries(grouped).map(([groupKey, items]) => {
        const meta = GROUP_META[groupKey] ?? {
          label: groupKey,
          icon: Bell,
        };
        const Icon = meta.icon;
        return (
          <div key={groupKey} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{meta.label}</span>
            </div>
            <ul className="divide-y divide-border/70">
              {items.map((m) => {
                const enabled = prefs[m.type];
                return (
                  <li
                    key={m.type}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => toggle(m.type)}
                      disabled={isPending}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                        enabled ? "bg-emerald-500" : "bg-muted",
                        isPending && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition",
                          enabled ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleReset} disabled={isPending}>
          <RotateCcw className="h-4 w-4 mr-2" />
          เปิดทั้งหมด
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          บันทึก
        </Button>
      </div>
    </div>
  );
}
