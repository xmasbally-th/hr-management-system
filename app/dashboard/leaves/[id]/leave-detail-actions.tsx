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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  /** ช่วงวันลาเดิม — ใช้จำกัดช่วงที่ขอยกเลิกบางส่วน */
  leaveStartDate: string;
  leaveEndDate: string;
}

// Direct cancellation only BEFORE the leave is sent to the university —
// after that the formal ใบขอยกเลิกวันลา workflow is required.
const CANCELLABLE_INPROCESS = [
  "pending", "awaiting_chair", "awaiting_director", "awaiting_dean", "approved",
];

export function LeaveDetailActions({
  requestId,
  status,
  isOwner,
  isSick,
  existingMedicalCert,
  canDownloadDoc = false,
  leaveStartDate,
  leaveEndDate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"cancel" | null>(null);
  const [medicalCertUrl, setMedicalCertUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── ใบขอยกเลิกวันลา (ทั้งใบ/บางช่วง) ──
  const [requestCancelOpen, setRequestCancelOpen] = useState(false);
  const [cancelScope, setCancelScope] = useState<"full" | "partial">("full");
  const [cancelStart, setCancelStart] = useState("");
  const [cancelEnd, setCancelEnd] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (existingMedicalCert) {
      getDocumentUrl(existingMedicalCert).then(setMedicalCertUrl).catch(() => setMedicalCertUrl(null));
    }
  }, [existingMedicalCert]);

  const showMedicalCertUpload = isOwner && isSick && status === "pending";
  // เจ้าของยกเลิกระหว่างกระบวนการ (ก่อนส่งมหาวิทยาลัย)
  const showInProcessCancel = isOwner && CANCELLABLE_INPROCESS.includes(status);
  // ยื่นใบขอยกเลิก — ใบที่ส่งมหาวิทยาลัย/เสร็จสิ้นแล้ว (เจ้าของ หรือ HR/Admin)
  const showRequestCancel =
    (status === "completed" || status === "awaiting_university") &&
    (isOwner || canDownloadDoc);

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

  function handleConfirm() {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;
    startTransition(async () => {
      try {
        await cancelLeaveRequest(requestId);
        toast.success("ยกเลิกคำขอลาแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  function handleRequestCancelSubmit() {
    if (!cancelReason.trim()) {
      toast.error("กรุณาระบุเหตุผลการยกเลิก");
      return;
    }
    if (cancelScope === "partial" && (!cancelStart || !cancelEnd)) {
      toast.error("กรุณาเลือกช่วงวันที่ที่ขอยกเลิก");
      return;
    }
    startTransition(async () => {
      try {
        await createLeaveCancellationRequest(
          requestId,
          cancelReason,
          cancelScope === "partial"
            ? { startDate: cancelStart, endDate: cancelEnd }
            : undefined,
        );
        toast.success("ยื่นคำขอยกเลิกแล้ว — รอเดินเอกสาร");
        setRequestCancelOpen(false);
        setCancelReason("");
        setCancelScope("full");
        setCancelStart("");
        setCancelEnd("");
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
            <Button variant="outline" className="text-destructive" onClick={() => setRequestCancelOpen(true)} disabled={isPending}>
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

      {/* ใบขอยกเลิกวันลา — ทั้งใบ หรือบางช่วง (ตามแบบฟอร์มราชการ) */}
      <Dialog open={requestCancelOpen} onOpenChange={setRequestCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยื่นคำขอยกเลิกใบลา</DialogTitle>
            <DialogDescription>
              ใบลานี้ลงนามครบ/ส่งมหาวิทยาลัยแล้ว การยกเลิกต้องเดินเอกสารผ่าน
              ผอ. → คณบดี → อธิการบดี ก่อนคืนสิทธิ์
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={cancelScope === "full"}
                  onChange={() => setCancelScope("full")}
                />
                ยกเลิกทั้งใบ
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={cancelScope === "partial"}
                  onChange={() => {
                    setCancelScope("partial");
                    if (!cancelStart) setCancelStart(leaveStartDate);
                    if (!cancelEnd) setCancelEnd(leaveEndDate);
                  }}
                />
                ยกเลิกบางช่วง
              </label>
            </div>

            {cancelScope === "partial" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ยกเลิกตั้งแต่วันที่</Label>
                  <ThaiDatePicker value={cancelStart} onChange={setCancelStart} disabled={isPending} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ถึงวันที่</Label>
                  <ThaiDatePicker value={cancelEnd} onChange={setCancelEnd} disabled={isPending} />
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  ต้องอยู่ภายในช่วงวันลาเดิม — ระบบคืนสิทธิ์เฉพาะวันทำการในช่วงที่ยกเลิก
                  (ใบลาเดิมคงไว้เป็นประวัติ)
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">เหตุผลการยกเลิก *</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                disabled={isPending}
                placeholder="เช่น กลับมาปฏิบัติราชการก่อนกำหนด"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestCancelOpen(false)} disabled={isPending}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleRequestCancelSubmit} disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                ยื่นคำขอยกเลิก
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
