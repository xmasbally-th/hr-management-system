"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelTravelRequest,
  createTravelCancellationRequest,
} from "@/lib/actions/travel-actions";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Ban,
  Loader2,
  FileText,
  FileDown,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  requestId: string;
  status: string;
  isOwner: boolean;
  isApprover: boolean;
  isHr: boolean;
  employeeName: string;
  scannedDocumentPath: string | null;
  hasActiveCancellation: boolean;
}

/**
 * Owner-facing + .docx-download actions for a travel request.
 *
 * D5 reshape:
 * - HR/Admin workflow buttons moved to <TravelWorkflowPanel>; this panel
 *   only handles owner cancel + post-completion cancellation request +
 *   docx download + scanned-document viewer.
 */
export function TravelDetailActions({
  requestId,
  status,
  isOwner,
  isHr,
  scannedDocumentPath,
  hasActiveCancellation,
}: Omit<Props, "isApprover" | "employeeName"> & {
  isApprover?: boolean;
  employeeName?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"cancel" | "request_cancellation" | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (scannedDocumentPath) {
      getDocumentUrl(scannedDocumentPath).then(setScannedUrl).catch(() => setScannedUrl(null));
    }
  }, [scannedDocumentPath]);

  const showCancelAction = isOwner && status === "pending";
  const showRequestCancellation = isOwner && status === "completed" && !hasActiveCancellation;
  // Owner can download a copy of their own order too (not just HR/Admin).
  const showOrderDownload = (isHr || isOwner) && (
    status === "approved" || status === "awaiting_university" || status === "completed"
  );
  const showScannedView = !!scannedDocumentPath;

  function handleConfirm(reason?: string) {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);

    startTransition(async () => {
      try {
        if (action === "cancel") {
          await cancelTravelRequest(requestId);
          toast.success("ยกเลิกคำขอแล้ว");
        } else if (action === "request_cancellation") {
          if (!reason || !reason.trim()) {
            toast.error("กรุณาระบุเหตุผลการยกเลิก");
            return;
          }
          await createTravelCancellationRequest(requestId, reason);
          toast.success("ยื่นคำขอยกเลิกแล้ว — รอ HR ตรวจสอบและเริ่มเดินเอกสาร");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  const hasAnyContent =
    showCancelAction ||
    showRequestCancellation ||
    showOrderDownload ||
    showScannedView;

  if (!hasAnyContent) return null;

  return (
    <>
      <div className="space-y-4">
        {showScannedView && (
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <p className="text-sm font-medium">เอกสารคำสั่งเดินทาง (สแกนแล้ว)</p>
            {scannedUrl ? (
              <a
                href={scannedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                ดูเอกสารที่สแกน
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">กำลังโหลดไฟล์...</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          {showOrderDownload && (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/documents/travel-order/${requestId}`, "_blank")}
            >
              <FileDown className="h-4 w-4 mr-2" />
              สร้างคำสั่งเดินทาง (.docx)
            </Button>
          )}
          {showCancelAction && (
            <Button
              variant="outline"
              onClick={() => setConfirmAction("cancel")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              ยกเลิกคำขอ
            </Button>
          )}
          {showRequestCancellation && (
            <Button
              variant="outline"
              onClick={() => setConfirmAction("request_cancellation")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              ยื่นคำขอยกเลิก (workflow แยก)
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการยกเลิก"
        description="ยกเลิกคำขอเดินทางนี้ใช่หรือไม่? การยกเลิกไม่สามารถเปลี่ยนกลับได้"
        confirmLabel="ยกเลิกคำขอ"
        variant="destructive"
        onConfirm={() => handleConfirm()}
      />
      <ConfirmDialog
        open={confirmAction === "request_cancellation"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยื่นคำขอยกเลิกคำสั่งเดินทาง"
        description="คำสั่งเดินทางเสร็จสิ้นแล้ว — การยกเลิกต้องเดินเอกสารผ่าน ผอ./คณบดี/อธิการบดี อีกครั้ง กรุณาระบุเหตุผล"
        confirmLabel="ยื่นคำขอยกเลิก"
        variant="destructive"
        withInput
        inputLabel="เหตุผลการยกเลิก"
        onConfirm={handleConfirm}
      />
    </>
  );
}
