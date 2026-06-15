"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  routeCancellationToDirector,
  markCancellationDirectorSigned,
  routeCancellationToDean,
  markCancellationDeanSigned,
  sendCancellationToPresident,
  completeCancellation,
  rejectCancellationAtStage,
} from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Loader2, ArrowRight, PenLine, CheckCircle2, XCircle, RotateCcw, Download } from "lucide-react";
import { toast } from "sonner";
import { formatThai as fmtThai } from "@/lib/date-ranges";

interface Tracking {
  director_signed_date: string | null;
  dean_signed_date: string | null;
  sent_to_president_date: string | null;
  president_signed_date: string | null;
}

interface Props {
  cancellationId: string;
  status: string;
  reason: string;
  tracking: Tracking | null;
  /** HR/Admin drive routing + any step; a designated ผอ./คณบดี (incl. dean
   *  acting-delegate) may sign/reject their own stage. */
  isHrAdmin: boolean;
  canDirector: boolean;
  canDean: boolean;
  /** ช่วงที่ขอยกเลิก (null = ยกเลิกทั้งใบ) */
  cancelRange: { start: string; end: string; workingDays: number } | null;
}

const STAGE: Record<string, { label: string }> = {
  pending: { label: "ใบขอยกเลิก: รอตรวจสอบ" },
  awaiting_director: { label: "ใบขอยกเลิก: รอผอ.สำนักงานลงนาม" },
  awaiting_dean: { label: "ใบขอยกเลิก: รอคณบดีลงนาม" },
  approved: { label: "ใบขอยกเลิก: คณบดีลงนามแล้ว — รอส่งอธิการบดี" },
  awaiting_university: { label: "ใบขอยกเลิก: รออธิการบดีรับทราบ" },
  completed: { label: "ใบขอยกเลิก: เสร็จสิ้น (ใบลาถูกยกเลิก คืนสิทธิ์แล้ว)" },
  rejected: { label: "ใบขอยกเลิก: ไม่ผ่านการพิจารณา" },
  cancelled: { label: "ใบขอยกเลิก: ถอน" },
};

type RejectLevel = "hr" | "director" | "dean" | "president";

export function CancellationWorkflowPanel({
  cancellationId,
  status,
  reason,
  tracking,
  isHrAdmin,
  canDirector,
  canDean,
  cancelRange,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectLevel, setRejectLevel] = useState<RejectLevel | null>(null);
  const [downloading, setDownloading] = useState(false);

  const stage = STAGE[status] ?? { label: status };
  const directorSigned = !!tracking?.director_signed_date;

  async function handleDownloadDoc() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/leave-cancellation-form/${cancellationId}`);
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
      a.download = m ? decodeURIComponent(m[1]) : `leave-cancellation-${cancellationId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  }

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

  function handleReject(r?: string) {
    const level = rejectLevel;
    setRejectLevel(null);
    if (!level) return;
    run(() => rejectCancellationAtStage(cancellationId, level, r ?? ""), "ปฏิเสธคำขอยกเลิกแล้ว");
  }

  const isTerminal = status === "completed" || status === "rejected" || status === "cancelled";

  return (
    <div className="border-2 border-amber-300 rounded-lg p-4 bg-amber-50/40 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <RotateCcw className="h-4 w-4 text-amber-700 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-amber-800 font-semibold">คำขอยกเลิกใบลา (workflow แยก)</p>
            <p className="font-medium text-sm truncate">{stage.label}</p>
          </div>
        </div>
        {!isTerminal && <Badge className="bg-amber-200 text-amber-900">กำลังดำเนินการ</Badge>}
      </div>

      {reason && (
        <div className="text-xs bg-white/60 rounded p-2 border border-amber-200">
          <span className="text-muted-foreground">เหตุผลการยกเลิก: </span>{reason}
        </div>
      )}

      <div className="text-xs bg-white/60 rounded p-2 border border-amber-200">
        <span className="text-muted-foreground">ขอบเขต: </span>
        {cancelRange ? (
          <>ยกเลิกบางช่วง {fmtThai(cancelRange.start)} – {fmtThai(cancelRange.end)} ({cancelRange.workingDays} วันทำการ) — ใบลาเดิมคงไว้ ปรับลดวันใช้สิทธิ์</>
        ) : (
          <>ยกเลิกทั้งใบ — เมื่อครบขั้นตอน ใบลาเดิมจะเปลี่ยนเป็น &quot;ยกเลิก&quot; และคืนสิทธิ์เต็มจำนวน</>
        )}
      </div>

      {/* Paper channel: HR prints the official cancellation form */}
      {isHrAdmin && (
        <Button variant="outline" size="sm" onClick={handleDownloadDoc} disabled={downloading}>
          {downloading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          ดาวน์โหลดใบขอยกเลิก (.docx)
        </Button>
      )}

      {!isTerminal && (
        <div className="flex flex-wrap gap-2">
          {status === "pending" && isHrAdmin && (
            <>
              <Button onClick={() => run(() => routeCancellationToDirector(cancellationId), "ส่งให้ผอ.สำนักงานแล้ว")} disabled={isPending}>
                <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้ผอ.สำนักงานลงนาม
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("hr")} disabled={isPending}>
                <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (HR)
              </Button>
            </>
          )}

          {status === "awaiting_director" && (
            <>
              {!directorSigned
                ? (canDirector || isHrAdmin) && (
                    <Button onClick={() => run(() => markCancellationDirectorSigned(cancellationId), "บันทึกผอ.สำนักงานเซ็นแล้ว")} disabled={isPending}>
                      <PenLine className="h-4 w-4 mr-2" /> บันทึก: ผอ.สำนักงานลงนาม
                    </Button>
                  )
                : isHrAdmin && (
                    <Button onClick={() => run(() => routeCancellationToDean(cancellationId), "ส่งให้คณบดีแล้ว")} disabled={isPending}>
                      <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้คณบดีลงนาม
                    </Button>
                  )}
              {isHrAdmin && (
                <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("director")} disabled={isPending}>
                  <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (ผอ.สำนักงาน)
                </Button>
              )}
            </>
          )}

          {status === "awaiting_dean" && (
            <>
              {(canDean || isHrAdmin) && (
                <Button onClick={() => run(() => markCancellationDeanSigned(cancellationId), "คณบดีลงนามแล้ว")} disabled={isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> บันทึก: คณบดีลงนาม
                </Button>
              )}
              {isHrAdmin && (
                <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("dean")} disabled={isPending}>
                  <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (คณบดี)
                </Button>
              )}
            </>
          )}

          {status === "approved" && isHrAdmin && (
            <Button onClick={() => run(() => sendCancellationToPresident(cancellationId), "ส่งอธิการบดีแล้ว")} disabled={isPending}>
              <ArrowRight className="h-4 w-4 mr-2" /> ส่งให้อธิการบดี
            </Button>
          )}

          {status === "awaiting_university" && isHrAdmin && (
            <>
              <Button onClick={() => run(() => completeCancellation(cancellationId), "ยกเลิกใบลา + คืนสิทธิ์แล้ว")} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> บันทึก: อธิการบดีรับทราบ (ยกเลิก + คืนสิทธิ์)
              </Button>
              <Button variant="outline" className="text-destructive" onClick={() => setRejectLevel("president")} disabled={isPending}>
                <XCircle className="h-4 w-4 mr-2" /> ปฏิเสธ (อธิการบดี)
              </Button>
            </>
          )}

          {isPending && <Loader2 className="h-4 w-4 animate-spin self-center" />}
        </div>
      )}

      <ConfirmDialog
        open={rejectLevel !== null}
        onOpenChange={(open) => !open && setRejectLevel(null)}
        title="ยืนยันการปฏิเสธคำขอยกเลิก"
        description="ระบุเหตุผลการปฏิเสธ — ใบลาเดิมจะคงสถานะเสร็จสิ้นไว้"
        confirmLabel="ปฏิเสธ"
        variant="destructive"
        withInput
        inputLabel="เหตุผล"
        onConfirm={handleReject}
      />
    </div>
  );
}
