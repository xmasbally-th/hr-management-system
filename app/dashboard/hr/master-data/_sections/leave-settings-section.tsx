"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeaveOnlineEnabled } from "@/lib/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface Props {
  enabled: boolean;
}

export function LeaveSettingsSection({ enabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(enabled);

  function handleToggle() {
    const next = !current;
    startTransition(async () => {
      try {
        await updateLeaveOnlineEnabled(next);
        setCurrent(next);
        toast.success(next ? "เปิดระบบยื่นลาออนไลน์แล้ว" : "ปิดระบบยื่นลาออนไลน์แล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="border border-border rounded-lg p-6 bg-card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-semibold text-base flex items-center gap-2">
              {current ? (
                <Wifi className="h-4 w-4 text-emerald-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              ระบบยื่นคำขอลาออนไลน์
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              เมื่อเปิด พนักงานสามารถยื่นคำขอลาผ่านระบบได้โดยตรง
              <br />
              เมื่อปิด พนักงานจะไม่สามารถยื่นออนไลน์ได้ แต่ HR ยังสามารถกรอกแทนได้ผ่านช่องทางกระดาษ
            </p>
          </div>

          <Badge
            variant={current ? "default" : "secondary"}
            className={current ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
          >
            {current ? "เปิด" : "ปิด"}
          </Badge>
        </div>

        <Button
          variant={current ? "destructive" : "default"}
          onClick={handleToggle}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : current ? (
            <WifiOff className="h-4 w-4 mr-2" />
          ) : (
            <Wifi className="h-4 w-4 mr-2" />
          )}
          {current ? "ปิดระบบยื่นลาออนไลน์" : "เปิดระบบยื่นลาออนไลน์"}
        </Button>
      </div>
    </div>
  );
}
