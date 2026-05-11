"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function LeavesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[leaves] Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">ไม่สามารถโหลดข้อมูลการลาได้</h2>
        <p className="text-muted-foreground max-w-md">
          เกิดข้อผิดพลาดในการเข้าถึงข้อมูลการลา กรุณาลองใหม่อีกครั้ง
        </p>
      </div>
      <Button onClick={reset} variant="outline">
        ลองใหม่
      </Button>
    </div>
  );
}
