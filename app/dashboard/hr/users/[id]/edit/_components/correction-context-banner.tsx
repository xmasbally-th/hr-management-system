"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  resolveCorrectionRequest,
  type CorrectionListRow,
} from "@/lib/actions/correction-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FIELD_LABELS } from "@/components/correction-request-form";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Info,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  correction: CorrectionListRow;
  /** Set to true when at least one save event has occurred since mount.
   *  Drives the banner switching from "active" → "post-save" CTA mode. */
  hasSavedSinceMount: boolean;
}

const SCOPE_LABEL: Record<CorrectionListRow["scope"], string> = {
  first_review: "ตรวจสอบครั้งแรก",
  post_approval: "แก้ไขเพิ่มเติม",
};

const STATUS_META: Record<
  CorrectionListRow["status"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "รอดำเนินการ", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: Clock },
  resolved: { label: "ดำเนินการแล้ว", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "ปฏิเสธ", cls: "bg-rose-50 text-rose-800 border-rose-200", icon: XCircle },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-50 text-slate-700 border-slate-200", icon: Ban },
};

const THAI_MONTHS_FULL = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS_FULL[d.getUTCMonth()];
  const yearBE = d.getUTCFullYear() + 543;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} ${hh}:${mm} น.`;
}

/**
 * Sticky-feeling banner shown above the edit form when HR navigated
 * from the corrections queue with `?correction=<id>`.
 *
 * Three render modes:
 *   1. correction.status !== 'pending'  → read-only history view
 *   2. pending + no save yet            → context view ("act on these fields")
 *   3. pending + saved at least once    → CTA view ("close the request?")
 */
export function CorrectionContextBanner({ correction, hasSavedSinceMount }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState("");
  const [deferred, setDeferred] = useState(false);

  // Mode resolution
  const isClosed = correction.status !== "pending";
  const showCTA = !isClosed && hasSavedSinceMount && !deferred;

  function handleResolve() {
    startTransition(async () => {
      try {
        await resolveCorrectionRequest(
          correction.id,
          resolveNote.trim() || undefined,
        );
        toast.success("ทำเครื่องหมายเสร็จสิ้นและแจ้งผู้ใช้แล้ว");
        router.push("/dashboard/hr/profile-corrections?status=pending");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  // ─── Closed: read-only history ──────────────────────────────────
  if (isClosed) {
    const meta = STATUS_META[correction.status];
    const Icon = meta.icon;
    return (
      <div
        className={cn(
          "rounded-xl border-2 p-4 space-y-2",
          meta.cls.replace("bg-", "bg-").replace("text-", "text-"),
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4" />
          <span className="font-semibold text-sm">
            คำขอแก้ไขจาก {correction.target_user_name ?? "ผู้ใช้"} — {meta.label}
          </span>
          <span className="text-xs ml-auto">
            ส่ง {formatThaiDateTime(correction.created_at)}
          </span>
        </div>
        {correction.resolver_note && (
          <p className="text-xs italic">
            หมายเหตุ: {correction.resolver_note}
          </p>
        )}
      </div>
    );
  }

  // ─── CTA view: prompt HR to close the request ──────────────────
  if (showCTA) {
    return (
      <>
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-emerald-900">
                บันทึกข้อมูลเรียบร้อย
              </div>
              <p className="text-sm text-emerald-800 mt-1">
                ทำเครื่องหมายเสร็จสิ้นคำขอแก้ไขนี้ด้วยไหม?
                ระบบจะแจ้งผู้ใช้และนำคำขอออกจากคิว
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setResolveOpen(true)}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-4 mr-1.5" />
                  ใช่ — ปิดคำขอ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeferred(true)}
                  disabled={isPending}
                >
                  ค้างไว้ก่อน — ยังต้องแก้เพิ่ม
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Resolve confirm dialog */}
        <AlertDialog
          open={resolveOpen}
          onOpenChange={(open) => {
            if (!open) {
              setResolveOpen(false);
              setResolveNote("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ทำเครื่องหมายว่าเสร็จสิ้น</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                ยืนยันว่าคุณดำเนินการแก้ไขข้อมูลของ{" "}
                <span className="font-medium">
                  {correction.target_user_name ?? "ผู้ใช้นี้"}
                </span>{" "}
                ตามคำขอแล้ว
              </p>
              <div>
                <Label className="text-xs">หมายเหตุ (ถ้ามี — ส่งให้ผู้ใช้)</Label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="เช่น 'แก้ไขนามสกุลและเบอร์โทรเรียบร้อย'"
                  rows={3}
                  maxLength={2000}
                  disabled={isPending}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleResolve();
                }}
                disabled={isPending}
              >
                {isPending ? "กำลังบันทึก..." : "ยืนยัน"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ─── Active context view (default) ──────────────────────────────
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-start gap-3">
        <Info className="size-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div>
            <div className="font-semibold text-amber-900">
              คำขอแก้ไขจาก {correction.target_user_name ?? "ผู้ใช้"}
            </div>
            <div className="text-xs text-amber-800 mt-0.5 flex flex-wrap items-center gap-2">
              <span>ส่งเมื่อ {formatThaiDateTime(correction.created_at)}</span>
              <span className="px-1.5 py-px rounded bg-amber-100 border border-amber-200">
                {SCOPE_LABEL[correction.scope]}
              </span>
              {deferred && (
                <span className="px-1.5 py-px rounded bg-slate-100 text-slate-700 border border-slate-200">
                  ค้างไว้ก่อน
                </span>
              )}
            </div>
          </div>

          {correction.fields_flagged.length > 0 && (
            <div>
              <div className="text-xs font-medium text-amber-900 mb-1">
                ฟิลด์ที่ผู้ใช้แจ้ง ({correction.fields_flagged.length}):
              </div>
              <div className="flex flex-wrap gap-1">
                {correction.fields_flagged.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-900 border border-amber-200"
                  >
                    ⭐ {FIELD_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-white border border-amber-200 p-3">
            <div className="text-xs font-medium text-amber-900 mb-1">
              รายละเอียดจากผู้ใช้:
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {correction.reason_text}
            </p>
          </div>

          <p className="text-xs text-amber-800">
            <ArrowLeft className="size-3 inline mr-1 rotate-90" />
            แก้ฟิลด์ที่ระบุด้านล่าง แล้วกดบันทึก ระบบจะถามให้ปิดคำขอ
          </p>
        </div>
      </div>
    </div>
  );
}
