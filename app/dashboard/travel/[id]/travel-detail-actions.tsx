"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  approveTravelRequest,
  rejectTravelRequest,
  cancelTravelRequest,
  completeTravelRequest,
  updateTravelScannedDocument,
} from "@/lib/actions/travel-actions";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileUpload } from "@/components/file-upload";
import {
  CheckCircle,
  XCircle,
  Ban,
  Loader2,
  FileText,
  FileDown,
  CheckCheck,
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
}

export function TravelDetailActions({
  requestId,
  status,
  isOwner,
  isApprover,
  isHr,
  employeeName,
  scannedDocumentPath,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "cancel" | "complete" | null>(null);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (scannedDocumentPath) {
      getDocumentUrl(scannedDocumentPath).then(setScannedUrl).catch(() => setScannedUrl(null));
    }
  }, [scannedDocumentPath]);

  const isPendingStatus = status === "pending";
  const isApproved = status === "approved";
  const showApproverActions = isApprover && isPendingStatus;
  const showCancelAction = isOwner && isPendingStatus;
  const showCompleteAction = isHr && isApproved;
  const showOrderDownload = isHr && (isApproved || status === "completed");
  const showScannedUpload = isHr && (isApproved || status === "completed");

  function handleConfirm(reason?: string) {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);

    startTransition(async () => {
      try {
        if (action === "approve") {
          await approveTravelRequest(requestId);
          toast.success("อนุมัติคำขอเดินทางแล้ว");
        } else if (action === "reject") {
          // rejectTravelRequest doesn't accept reason — log only
          void reason;
          await rejectTravelRequest(requestId);
          toast.success("ปฏิเสธคำขอเดินทางแล้ว");
        } else if (action === "cancel") {
          await cancelTravelRequest(requestId);
          toast.success("ยกเลิกคำขอแล้ว");
        } else if (action === "complete") {
          await completeTravelRequest(requestId);
          toast.success("ปิดงานเดินทางแล้ว");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  async function handleScannedUploaded(path: string) {
    try {
      await updateTravelScannedDocument(requestId, path);
      toast.success(path ? "บันทึกเอกสารสแกนแล้ว" : "ลบเอกสารสแกนแล้ว");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const hasAnyContent =
    showApproverActions ||
    showCancelAction ||
    showCompleteAction ||
    showOrderDownload ||
    showScannedUpload ||
    scannedDocumentPath;

  if (!hasAnyContent) return null;

  return (
    <>
      <div className="space-y-4">
        {/* Scanned document section (HR only, after approved) */}
        {(showScannedUpload || scannedDocumentPath) && (
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <p className="text-sm font-medium">เอกสารคำสั่งเดินทาง (สแกนแล้ว)</p>
            {scannedDocumentPath && scannedUrl ? (
              <a
                href={scannedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                ดูเอกสารที่สแกน
              </a>
            ) : null}
            {showScannedUpload && (
              <FileUpload
                pathPrefix={`travel/${requestId}/scanned`}
                onUploaded={handleScannedUploaded}
                existingPath={scannedDocumentPath}
                label=""
              />
            )}
          </div>
        )}

        {/* Action buttons */}
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
              <Ban className="h-4 w-4 mr-2" />
              ยกเลิกคำขอ
            </Button>
          )}
          {showCompleteAction && (
            <Button
              variant="default"
              onClick={() => setConfirmAction("complete")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              ปิดงานเดินทาง
            </Button>
          )}
          {showApproverActions && (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirmAction("reject")}
                disabled={isPending}
              >
                <XCircle className="h-4 w-4 mr-2" />
                ไม่อนุมัติ
              </Button>
              <Button
                onClick={() => setConfirmAction("approve")}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                อนุมัติ
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการอนุมัติ"
        description={`อนุมัติคำขอเดินทางของ ${employeeName} ใช่หรือไม่?`}
        confirmLabel="อนุมัติ"
        onConfirm={() => handleConfirm()}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการไม่อนุมัติ"
        description={`ไม่อนุมัติคำขอเดินทางของ ${employeeName} ใช่หรือไม่?`}
        confirmLabel="ไม่อนุมัติ"
        variant="destructive"
        onConfirm={() => handleConfirm()}
      />
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
        open={confirmAction === "complete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการปิดงาน"
        description="ปิดงานเดินทางนี้ใช่หรือไม่? หลังปิดงานจะไม่สามารถแก้ไขสถานะได้อีก"
        confirmLabel="ปิดงาน"
        onConfirm={() => handleConfirm()}
      />
    </>
  );
}
