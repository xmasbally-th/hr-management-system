"use client";

import { useState } from "react";
import { CheckCircle2, Clock, FileText, XCircle, Loader2 } from "lucide-react";
import { getDocumentUrl } from "@/lib/actions/storage-actions";
import { toast } from "sonner";

interface Tracking {
  // leave / cancellation columns
  sent_to_director_date: string | null;
  director_signed_date: string | null;
  sent_to_dean_date: string | null;
  dean_signed_date: string | null;
  scanned_upload_date: string | null;
  scanned_document_url: string | null;
  sent_to_president_date: string | null;
  president_signed_date: string | null;
  president_document_url: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  reject_level: string | null;
  // travel columns (legacy)
  sent_for_signature_date: string | null;
  returned_date: string | null;
  sent_to_agency_date: string | null;
}

interface Stage {
  label: string;
  date: string | null;
  fileUrl?: string | null;
}

function leaveStages(t: Tracking): Stage[] {
  return [
    { label: "ส่งผอ.สำนักงานลงนาม", date: t.sent_to_director_date },
    { label: "ผอ.สำนักงานลงนาม", date: t.director_signed_date },
    { label: "ส่งคณบดีลงนาม", date: t.sent_to_dean_date },
    { label: "คณบดีลงนาม (อนุมัติ)", date: t.dean_signed_date },
    { label: "สแกน + อัปโหลดเอกสาร (ระดับคณะ)", date: t.scanned_upload_date, fileUrl: t.scanned_document_url },
    { label: "ส่งมหาวิทยาลัย/อธิการบดี", date: t.sent_to_president_date },
    { label: "รับเอกสารคืน (อธิการบดีลงนาม) — เสร็จสิ้น", date: t.president_signed_date, fileUrl: t.president_document_url },
  ];
}

function cancellationStages(t: Tracking): Stage[] {
  return [
    { label: "ส่งผอ.สำนักงานลงนาม", date: t.sent_to_director_date },
    { label: "ผอ.สำนักงานลงนาม", date: t.director_signed_date },
    { label: "ส่งคณบดีลงนาม", date: t.sent_to_dean_date },
    { label: "คณบดีลงนาม", date: t.dean_signed_date },
    { label: "ส่งอธิการบดี", date: t.sent_to_president_date },
    { label: "อธิการบดีรับทราบ — ยกเลิก + คืนสิทธิ์", date: t.president_signed_date },
  ];
}

function travelStages(t: Tracking): Stage[] {
  // D5: travel now follows the leave 2-level signature flow + optional
  // university step. Columns are the same shared `document_tracking`
  // columns used by leave.
  return [
    { label: "ส่งผอ.สำนักงานลงนาม", date: t.sent_to_director_date },
    { label: "ผอ.สำนักงานลงนาม", date: t.director_signed_date },
    { label: "ส่งคณบดีลงนาม", date: t.sent_to_dean_date },
    { label: "คณบดีลงนาม (อนุมัติ)", date: t.dean_signed_date },
    { label: "สแกน + อัปโหลดคำสั่ง (ระดับคณะ)", date: t.scanned_upload_date, fileUrl: t.scanned_document_url },
    { label: "ส่งมหาวิทยาลัย/อธิการบดี", date: t.sent_to_president_date },
    { label: "รับเอกสารคืน (อธิการบดีลงนาม) — เสร็จสิ้น", date: t.president_signed_date, fileUrl: t.president_document_url },
  ];
}

/** D5: cancellation of a completed travel order — mirrors cancellationStages. */
function travelCancellationStages(t: Tracking): Stage[] {
  return [
    { label: "ส่งผอ.สำนักงานลงนาม", date: t.sent_to_director_date },
    { label: "ผอ.สำนักงานลงนาม", date: t.director_signed_date },
    { label: "ส่งคณบดีลงนาม", date: t.sent_to_dean_date },
    { label: "คณบดีลงนาม", date: t.dean_signed_date },
    { label: "ส่งอธิการบดี", date: t.sent_to_president_date },
    { label: "อธิการบดีรับทราบ — ยกเลิกคำสั่งเดินทาง", date: t.president_signed_date },
  ];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("th-TH", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function levelLabel(level: string | null): string {
  switch (level) {
    case "hr": return "HR";
    case "director": return "ผอ.สำนักงาน";
    case "dean": return "คณบดี";
    case "president": return "อธิการบดี";
    default: return level ?? "";
  }
}

export function DocumentWorkflowTimeline({
  tracking,
  docType,
}: {
  tracking: Tracking | null;
  docType: string;
}) {
  if (!tracking) {
    return <p className="text-sm text-muted-foreground">ยังไม่ได้เริ่มเดินเอกสาร</p>;
  }

  const stages =
    docType === "leave_cancellation" ? cancellationStages(tracking)
    : docType === "travel_cancellation" ? travelCancellationStages(tracking)
    : docType === "leave" ? leaveStages(tracking)
    : travelStages(tracking);

  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => (
        <StageRow key={i} stage={s} />
      ))}
      {tracking.rejected_at && (
        <li className="flex items-start gap-3 pt-2 border-t border-destructive/30">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-destructive font-medium">
              ปฏิเสธโดย {levelLabel(tracking.reject_level)}
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(tracking.rejected_at)}</p>
            {tracking.reject_reason && (
              <p className="text-xs text-destructive mt-1">เหตุผล: {tracking.reject_reason}</p>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}

function StageRow({ stage }: { stage: Stage }) {
  const done = !!stage.date;
  return (
    <li className="flex items-start gap-3">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
      ) : (
        <Clock className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? "" : "text-muted-foreground"}`}>{stage.label}</p>
        {done && <p className="text-xs text-muted-foreground">{formatDateTime(stage.date)}</p>}
        {done && stage.fileUrl && <FileLink path={stage.fileUrl} />}
      </div>
    </li>
  );
}

function FileLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const signed = await getDocumentUrl(path);
      window.open(signed, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("เปิดไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      ดูไฟล์
    </button>
  );
}
