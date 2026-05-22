"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  cancelLeaveRequest,
  createLeaveCancellationRequest,
  updateLeaveMedicalCert,
} from "@/lib/actions/leave-actions";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileUpload } from "@/components/file-upload";
import { Ban, Loader2, FileText, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  requestId: string;
  status: string;
  isOwner: boolean;
  isSick: boolean;
  existingMedicalCert: string | null;
  canDownloadDoc?: boolean;
}

const CANCELLABLE_INPROCESS = [
  "pending", "awaiting_director", "awaiting_dean", "approved", "awaiting_university",
];

export function LeaveDetailActions({
  requestId,
  status,
  isOwner,
  isSick,
  existingMedicalCert,
  canDownloadDoc = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"cancel" | "requestCancel" | null>(null);
  const [medicalCertUrl, setMedicalCertUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (existingMedicalCert) {
      getDocumentUrl(existingMedicalCert).then(setMedicalCertUrl).catch(() => setMedicalCertUrl(null));
    }
  }, [existingMedicalCert]);

  const showMedicalCertUpload = isOwner && isSick && status === "pending";
  // เจ้าของยกเลิกระหว่างกระบวนการ
  const showInProcessCancel = isOwner && CANCELLABLE_INPROCESS.includes(status);
  // ยื่นขอยกเลิกใบที่เสร็จสิ้นแล้ว (เจ้าของ หรือ HR/Admin)
  const showRequestCancel = status === "completed" && (isOwner || canDownloadDoc);

  async function handleDownloadDoc() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/leave-form/${requestId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "ดาวน์โหลดไม่สำเร็จ");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename\*=UTF-8''(.+)$/);
      a.download = m ? decodeURIComponent(m[1]) : `leave-${requestId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  }

  function handleConfirm(reason?: string) {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;
    startTransition(async () => {
      try {
        if (action === "cancel") {
          await cancelLeaveRequest(requestId);
          toast.success("ยกเลิกคำขอลาแล้ว");
        } else if (action === "requestCancel") {
          if (!reason || !reason.trim()) {
            toast.error("กรุณาระบุเหตุผลการยกเลิก");
            return;
          }
          await createLeaveCancellationRequest(requestId, reason);
          toast.success("ยื่นคำขอยกเลิกแล้ว — รอเดินเอกสาร");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  async function handleMedicalCertUploaded(path: string) {
    try {
      await updateLeaveMedicalCert(requestId, path);
      toast.success(path ? "บันทึกใบรับรองแพทย์แล้ว" : "ลบใบรับรองแพทย์แล้ว");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  const hasAnything =
    showMedicalCertUpload || showInProcessCancel || showRequestCancel ||
    existingMedicalCert || canDownloadDoc;
  if (!hasAnything) return null;

  return (
    <>
      <div className="space-y-4">
        {/* Medical certificate (sick leave) */}
        {isSick && (existingMedicalCert || showMedicalCertUpload) && (
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <p className="text-sm font-medium">ใบรับรองแพทย์</p>
            {existingMedicalCert && medicalCertUrl ? (
              <a
                href={medicalCertUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" /> ดูเอกสาร
              </a>
            ) : null}
            {showMedicalCertUpload && (
              <FileUpload
                pathPrefix={`leaves/${requestId}/medical-cert`}
                onUploaded={handleMedicalCertUploaded}
                existingPath={existingMedicalCert}
                label=""
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          {canDownloadDoc && (
            <Button variant="outline" onClick={handleDownloadDoc} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              ดาวน์โหลดใบลา (.docx)
            </Button>
          )}
          {showInProcessCancel && (
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmAction("cancel")} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              ยกเลิกคำขอ
            </Button>
          )}
          {showRequestCancel && (
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmAction("requestCancel")} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              ยื่นขอยกเลิกใบลา
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการยกเลิก"
        description="ยกเลิกคำขอลานี้ใช่หรือไม่? ระบบจะคืนสิทธิ์วันลา"
        confirmLabel="ยกเลิกคำขอ"
        variant="destructive"
        onConfirm={() => handleConfirm()}
      />
      <ConfirmDialog
        open={confirmAction === "requestCancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยื่นคำขอยกเลิกใบลา (ที่เสร็จสิ้นแล้ว)"
        description="ใบลานี้ลงนามครบแล้ว การยกเลิกต้องเดินเอกสารผ่าน ผอ. → คณบดี → อธิการบดี ก่อนคืนสิทธิ์"
        confirmLabel="ยื่นคำขอยกเลิก"
        variant="destructive"
        withInput
        inputLabel="เหตุผลการยกเลิก"
        onConfirm={handleConfirm}
      />
    </>
  );
}
