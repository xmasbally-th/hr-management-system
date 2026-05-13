"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  updateLeaveMedicalCert,
} from "@/lib/actions/leave-actions";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileUpload } from "@/components/file-upload";
import { CheckCircle, XCircle, Ban, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  requestId: string;
  status: string;
  isOwner: boolean;
  isApprover: boolean;
  isSick: boolean;
  employeeName: string;
  existingMedicalCert: string | null;
}

export function LeaveDetailActions({
  requestId,
  status,
  isOwner,
  isApprover,
  isSick,
  employeeName,
  existingMedicalCert,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "cancel" | null>(null);
  const [medicalCertUrl, setMedicalCertUrl] = useState<string | null>(null);

  // Resolve signed URL for existing medical certificate (for read-only view)
  useEffect(() => {
    if (existingMedicalCert) {
      getDocumentUrl(existingMedicalCert).then(setMedicalCertUrl).catch(() => setMedicalCertUrl(null));
    }
  }, [existingMedicalCert]);

  const isPending2 = status === "pending";
  const showApproverActions = isApprover && isPending2;
  const showCancelAction = isOwner && isPending2;
  const showMedicalCertUpload = isOwner && isSick && isPending2;

  function handleConfirm(reason?: string) {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);

    startTransition(async () => {
      try {
        if (action === "approve") {
          await approveLeaveRequest(requestId);
          toast.success("อนุมัติคำขอลาแล้ว");
        } else if (action === "reject") {
          await rejectLeaveRequest(requestId, reason);
          toast.success("ปฏิเสธคำขอลาแล้ว");
        } else if (action === "cancel") {
          await cancelLeaveRequest(requestId);
          toast.success("ยกเลิกคำขอลาแล้ว");
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

  if (!showApproverActions && !showCancelAction && !showMedicalCertUpload && !existingMedicalCert) {
    return null;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Medical certificate section (sick leave only) */}
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
                <FileText className="h-4 w-4" />
                ดูเอกสาร
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

        {/* Action buttons */}
        {(showApproverActions || showCancelAction) && (
          <div className="flex flex-wrap gap-2 justify-end">
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
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการอนุมัติ"
        description={`อนุมัติคำขอลาของ ${employeeName} ใช่หรือไม่?`}
        confirmLabel="อนุมัติ"
        onConfirm={() => handleConfirm()}
      />
      <ConfirmDialog
        open={confirmAction === "reject"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการไม่อนุมัติ"
        description={`ไม่อนุมัติคำขอลาของ ${employeeName} ใช่หรือไม่?`}
        confirmLabel="ไม่อนุมัติ"
        variant="destructive"
        withInput
        inputLabel="เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)"
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirmAction === "cancel"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันการยกเลิก"
        description="ยกเลิกคำขอลานี้ใช่หรือไม่? การยกเลิกไม่สามารถเปลี่ยนกลับได้"
        confirmLabel="ยกเลิกคำขอ"
        variant="destructive"
        onConfirm={() => handleConfirm()}
      />
    </>
  );
}
