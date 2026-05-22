"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  routeToDirector,
  markDirectorSigned,
  routeToDean,
  markDeanSigned,
  markLeaveScanned,
  sendLeaveToUniversity,
  receiveLeaveFromUniversity,
  completeLeaveAtFaculty,
  rejectLeaveAtStage,
} from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Loader2, ArrowRight, PenLine, ScanLine, Building2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Tracking {
  director_signed_date: string | null;
  dean_signed_date: string | null;
  sent_to_president_date: string | null;
  president_signed_date: string | null;
  scanned_upload_date: string | null;
}

interface Props {
  requestId: string;
  status: string;
  tracking: Tracking | null;
}

const STAGE: Record<string, { label: string; step: number }> = {
  pending: { label: "รอตรวจสอบ / เริ่มเดินเอกสาร", step: 0 },
  awaiting_director: { label: "รอผู้อำนวยการลงนาม", step: 1 },
  awaiting_dean: { label: "รอคณบดีลงนาม", step: 2 },
  approved: { label: "อนุมัติแล้ว (คณบดีลงนาม)", step: 3 },
  awaiting_university: { label: "ส่งมหาวิทยาลัย — รออธิการบดีลงนาม", step: 4 },
  completed: { label: "เสร็จสิ้น", step: 5 },
  rejected: { label: "ไม่อนุมัติ", step: -1 },
  cancelled: { label: "ยกเลิก", step: -1 },
};

type RejectLevel = "hr" | "director" | "dean" | "president";

export function LeaveWorkflowPanel({ requestId, status, tracking }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectLevel, setRejectLevel] = useState<RejectLevel | null>(null);
  const [showScanUpload, setShowScanUpload] = useState(false);
  const [showReceiveUpload, setShowReceiveUpload] = useState(false);

  const stage = STAGE[status] ?? { label: status, step: 0 };
  const directorSigned = !!tracking?.director_signed_date;

  function run(fn: () => Promise<unknown>, okMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMsg);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
      }
    });
  }

  function handleReject(reason?: string) {
    const level = rejectLevel;
    setRejectLevel(null);
    if (!level) return;
    run(() => rejectLeaveAtStage(requestId, level, reason ?? ""), "ปฏิเสธคำขอแล้ว");
  }

  // terminal states — no workflow actions
  if (status === "rejected" || status === "cancelled" || status === "completed") {
    return (
      <div className="border rounded-lg p-4 bg-card">
        <StageHeader stage={stage} />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <StageHeader stage={stage} />

      <div className="flex flex-wrap gap-2">
        {status === "pending" && (
          <>
            <Button onClick={() => run(() => routeToDirector(requestId), "ส่งให้ผู้อำนวยการแล้ว")} disabled={isPending}>
              <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้ผู้อำนวยการลงนาม
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("hr")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (HR)
            </Button>
          </>
        )}

        {status === "awaiting_director" && (
          <>
            {!directorSigned ? (
              <Button onClick={() => run(() => markDirectorSigned(requestId), "บันทึกผู้อำนวยการลงนามแล้ว")} disabled={isPending}>
                <PenLine className="h-4 w-4 mr-2" /> บันทึก: ผู้อำนวยการลงนามแล้ว
              </Button>
            ) : (
              <Button onClick={() => run(() => routeToDean(requestId), "ส่งให้คณบดีแล้ว")} disabled={isPending}>
                <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้คณบดีลงนาม
              </Button>
            )}
            <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("director")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (ผอ.)
            </Button>
          </>
        )}

        {status === "awaiting_dean" && (
          <>
            <Button onClick={() => run(() => markDeanSigned(requestId), "คณบดีลงนาม — อนุมัติแล้ว")} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> บันทึก: คณบดีลงนาม (อนุมัติ)
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("dean")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (คณบดี)
            </Button>
          </>
        )}

        {status === "approved" && (
          <>
            <Button variant="outline" onClick={() => setShowScanUpload((v) => !v)} disabled={isPending}>
              <ScanLine className="h-4 w-4 mr-2" /> สแกน+อัปโหลดเอกสาร (คณะ)
            </Button>
            <Button onClick={() => run(() => sendLeaveToUniversity(requestId), "ส่งมหาวิทยาลัยแล้ว")} disabled={isPending}>
              <Building2 className="h-4 w-4 mr-2" /> ส่งมหาวิทยาลัย/อธิการบดี
            </Button>
            <Button variant="outline" onClick={() => run(() => completeLeaveAtFaculty(requestId), "เสร็จสิ้น (ระดับคณะ)")} disabled={isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> จบที่ระดับคณะ
            </Button>
          </>
        )}

        {status === "awaiting_university" && (
          <>
            <Button variant="outline" onClick={() => setShowReceiveUpload((v) => !v)} disabled={isPending}>
              <ScanLine className="h-4 w-4 mr-2" /> รับเอกสารคืน + อัปโหลด (เสร็จสิ้น)
            </Button>
            <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("president")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (อธิการบดี)
            </Button>
          </>
        )}

        {isPending && <Loader2 className="h-4 w-4 animate-spin self-center" />}
      </div>

      {showScanUpload && status === "approved" && (
        <div className="rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground mb-2">อัปโหลดเอกสารใบลาที่ลงนามครบระดับคณะ</p>
          <FileUpload
            pathPrefix={`leaves/${requestId}/faculty-signed`}
            onUploaded={(path) => run(() => markLeaveScanned(requestId, path), "บันทึกเอกสารแล้ว")}
            label="คลิกหรือลากไฟล์ (PDF/รูป)"
          />
        </div>
      )}

      {showReceiveUpload && status === "awaiting_university" && (
        <div className="rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground mb-2">อัปโหลดเอกสารที่อธิการบดีลงนามกลับมา → จบกระบวนการ</p>
          <FileUpload
            pathPrefix={`leaves/${requestId}/university-signed`}
            onUploaded={(path) => run(() => receiveLeaveFromUniversity(requestId, path), "รับเอกสารคืน — เสร็จสิ้น")}
            label="คลิกหรือลากไฟล์ (PDF/รูป)"
          />
        </div>
      )}

      <ConfirmDialog
        open={rejectLevel !== null}
        onOpenChange={(open) => !open && setRejectLevel(null)}
        title="ยืนยันการปฏิเสธ"
        description="ระบุเหตุผลการปฏิเสธ — ระบบจะคืนสิทธิ์วันลาและแจ้งพนักงาน"
        confirmLabel="ปฏิเสธ"
        variant="destructive"
        withInput
        inputLabel="เหตุผล"
        onConfirm={handleReject}
      />
    </div>
  );
}

function StageHeader({ stage }: { stage: { label: string; step: number } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground">สถานะการเดินเอกสาร</p>
        <p className="font-semibold">{stage.label}</p>
      </div>
      {stage.step >= 0 && (
        <Badge variant="secondary" className="font-mono">ขั้น {stage.step}/5</Badge>
      )}
    </div>
  );
}
