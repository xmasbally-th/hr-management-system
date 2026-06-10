"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  routeToChair,
  markChairSigned,
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
import { Loader2, ArrowRight, PenLine, ScanLine, Building2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Tracking {
  director_signed_date: string | null;
  dean_signed_date: string | null;
  sent_to_president_date: string | null;
  president_signed_date: string | null;
  scanned_upload_date: string | null;
  chair_signed_date?: string | null;
}

interface Props {
  requestId: string;
  status: string;
  tracking: Tracking | null;
  /** HR/Admin can drive every step (routing + signing). */
  isHrAdmin: boolean;
  /** Viewer is the designated chair/director/dean for this request and may
   *  perform their own signature step. */
  canChair: boolean;
  canDirector: boolean;
  canDean: boolean;
  /** This leave routes through ประธานสาขา (ลาพักผ่อน + สายวิชาการ). */
  needsChair: boolean;
  existingOpinion: string | null;
  /** Approver roles in this leave's path that have nobody assigned yet. */
  unassignedApprovers: string[];
}

const STAGE: Record<string, { label: string; step: number }> = {
  pending: { label: "รอตรวจสอบ / เริ่มเดินเอกสาร", step: 0 },
  awaiting_chair: { label: "รอประธานสาขาให้ความเห็น", step: 1 },
  awaiting_director: { label: "รอผู้อำนวยการลงนาม", step: 2 },
  awaiting_dean: { label: "รอคณบดีลงนาม", step: 3 },
  approved: { label: "อนุมัติแล้ว (คณบดีลงนาม)", step: 4 },
  awaiting_university: { label: "ส่งมหาวิทยาลัย — รออธิการบดีลงนาม", step: 5 },
  completed: { label: "เสร็จสิ้น", step: 6 },
  rejected: { label: "ไม่อนุมัติ", step: -1 },
  cancelled: { label: "ยกเลิก", step: -1 },
};

type RejectLevel = "hr" | "chair" | "director" | "dean" | "president";

export function LeaveWorkflowPanel({
  requestId,
  status,
  tracking,
  isHrAdmin,
  canChair,
  canDirector,
  canDean,
  needsChair,
  existingOpinion,
  unassignedApprovers,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectLevel, setRejectLevel] = useState<RejectLevel | null>(null);
  const [showScanUpload, setShowScanUpload] = useState(false);
  const [showReceiveUpload, setShowReceiveUpload] = useState(false);
  const [opinion, setOpinion] = useState(existingOpinion ?? "");

  const stage = STAGE[status] ?? { label: status, step: 0 };
  const directorSigned = !!tracking?.director_signed_date;
  const chairSigned = !!tracking?.chair_signed_date;

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

      {isHrAdmin &&
        unassignedApprovers.length > 0 &&
        ["pending", "awaiting_chair", "awaiting_director", "awaiting_dean"].includes(status) && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              ยังไม่ได้กำหนดผู้ลงนามระดับ <b>{unassignedApprovers.join(" · ")}</b> —
              คำขอจะค้างที่ขั้นนั้นจนกว่าจะกำหนด (ที่ &quot;ข้อมูลหลัก → ผู้อนุมัติการลา&quot;) หรือ HR ลงนามแทน
            </span>
          </div>
        )}

      <div className="flex flex-wrap gap-2">
        {status === "pending" && isHrAdmin && (
          <>
            {needsChair ? (
              <Button onClick={() => run(() => routeToChair(requestId), "ส่งให้ประธานสาขาแล้ว")} disabled={isPending}>
                <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้ประธานสาขาวิชา
              </Button>
            ) : (
              <Button onClick={() => run(() => routeToDirector(requestId), "ส่งให้ผู้อำนวยการแล้ว")} disabled={isPending}>
                <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้ผู้อำนวยการลงนาม
              </Button>
            )}
            <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("hr")} disabled={isPending}>
              <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (HR)
            </Button>
          </>
        )}

        {status === "awaiting_chair" && (
          <>
            {(canChair || isHrAdmin) && !chairSigned && (
              <div className="w-full space-y-2">
                <label className="text-xs text-muted-foreground">ความเห็นประธานสาขาวิชา (ถ้ามี)</label>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  disabled={isPending}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="เช่น เห็นควรอนุมัติ · ผู้ปฏิบัติงานแทนเหมาะสม"
                />
                <Button onClick={() => run(() => markChairSigned(requestId, opinion), "ประธานสาขาลงนามแล้ว")} disabled={isPending}>
                  <PenLine className="h-4 w-4 mr-2" /> บันทึก: ประธานสาขาลงนาม
                </Button>
              </div>
            )}
            {isHrAdmin && chairSigned && (
              <Button onClick={() => run(() => routeToDirector(requestId), "ส่งให้ผู้อำนวยการแล้ว")} disabled={isPending}>
                <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้ผู้อำนวยการลงนาม
              </Button>
            )}
            {(canChair || isHrAdmin) && (
              <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("chair")} disabled={isPending}>
                <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (ประธานสาขา)
              </Button>
            )}
          </>
        )}

        {status === "awaiting_director" && (
          <>
            {!directorSigned
              ? (canDirector || isHrAdmin) && (
                  <Button onClick={() => run(() => markDirectorSigned(requestId), "บันทึกผู้อำนวยการลงนามแล้ว")} disabled={isPending}>
                    <PenLine className="h-4 w-4 mr-2" /> บันทึก: ผู้อำนวยการลงนามแล้ว
                  </Button>
                )
              : isHrAdmin && (
                  <Button onClick={() => run(() => routeToDean(requestId), "ส่งให้คณบดีแล้ว")} disabled={isPending}>
                    <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้คณบดีลงนาม
                  </Button>
                )}
            {(canDirector || isHrAdmin) && (
              <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("director")} disabled={isPending}>
                <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (ผอ.)
              </Button>
            )}
          </>
        )}

        {status === "awaiting_dean" && (
          <>
            {(canDean || isHrAdmin) && (
              <Button onClick={() => run(() => markDeanSigned(requestId), "คณบดีลงนาม — อนุมัติแล้ว")} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> บันทึก: คณบดีลงนาม (อนุมัติ)
              </Button>
            )}
            {(canDean || isHrAdmin) && (
              <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("dean")} disabled={isPending}>
                <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (คณบดี)
              </Button>
            )}
          </>
        )}

        {status === "approved" && isHrAdmin && (
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

        {status === "awaiting_university" && isHrAdmin && (
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
        <Badge variant="secondary" className="font-mono">ขั้น {stage.step}/6</Badge>
      )}
    </div>
  );
}
