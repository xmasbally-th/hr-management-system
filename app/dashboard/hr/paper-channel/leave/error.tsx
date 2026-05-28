"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

/**
 * Route-segment error boundary for /dashboard/hr/paper-channel/leave.
 * Exposes the digest so we can correlate with Vercel function logs when
 * the page errors in production.
 */
export default function PaperLeaveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[paper-leave] Error:", error, "digest:", error?.digest);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-4">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">ไม่สามารถโหลดหน้าบันทึกใบลากระดาษได้</h2>
        <p className="text-muted-foreground max-w-md">
          เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง
        </p>
        {error?.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            รหัสอ้างอิงสำหรับแจ้งผู้ดูแล: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline">
        ลองใหม่
      </Button>
    </div>
  );
}
