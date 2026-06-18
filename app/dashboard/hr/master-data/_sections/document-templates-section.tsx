"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadLeaveTemplate,
  uploadTravelTemplate,
  deleteLeaveTemplate,
  type LeaveTemplate,
} from "@/lib/actions/template-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Upload, Loader2, Trash2, FileText, CheckCircle2, Copy, FileUp,
} from "lucide-react";
import { toast } from "sonner";

type FormType = { code: string; label: string };

const FORM_TYPES: FormType[] = [
  { code: "", label: "ทั่วไป (ใช้เมื่อไม่มีเทมเพลตเฉพาะประเภท)" },
  { code: "SICK", label: "ใบลาป่วย" },
  { code: "PERSONAL", label: "ใบลากิจส่วนตัว" },
  { code: "VACATION", label: "ใบลาพักผ่อน" },
  { code: "MATERNITY", label: "ใบลาคลอดบุตร" },
  { code: "CANCELLATION", label: "ใบขอยกเลิกวันลา" },
];

// Placeholders available to each form type (matches lib/document-templates/leave-merge.ts).
const COMMON = [
  "title_th", "full_name", "position", "department", "leave_type",
  "start_date", "end_date", "total_days", "working_days", "reason",
  "contact", "today_thai",
];
const VACATION_EXTRA = [
  "accumulated_days", "annual_days", "total_entitlement",
  "used_before", "used_total", "remaining_days",
  "substitute_1", "substitute_2", "substitute_3", "branch_head_opinion",
];
const PLACEHOLDERS_BY_CODE: Record<string, string[]> = {
  "": [...COMMON, "edd", ...VACATION_EXTRA],
  SICK: COMMON,
  PERSONAL: COMMON,
  MATERNITY: [...COMMON, "edd"],
  VACATION: [...COMMON, ...VACATION_EXTRA],
  CANCELLATION: [...COMMON, "cancel_reason", "cancel_request_date"],
};

// คำอธิบายภาษาไทยของแต่ละ placeholder — แสดงกำกับเพื่อไม่ให้วางผิดตำแหน่ง
const PLACEHOLDER_LABELS: Record<string, string> = {
  title_th: "คำนำหน้าชื่อ (นาย/นาง/น.ส.)",
  full_name: "ชื่อ–นามสกุล ผู้ขอลา",
  position: "ตำแหน่ง",
  department: "สังกัด / หน่วยงาน",
  leave_type: "ประเภทการลา",
  start_date: "วันที่เริ่มลา",
  end_date: "วันที่สิ้นสุดการลา",
  total_days: "จำนวนวันลา (วันปฏิทิน)",
  working_days: "จำนวนวันลา (วันทำการ)",
  reason: "เหตุผลการลา",
  contact: "ที่อยู่/เบอร์ติดต่อระหว่างลา",
  today_thai: "วันที่ปัจจุบัน (แบบไทย)",
  edd: "วันกำหนดคลอด (ลาคลอด)",
  accumulated_days: "วันลาพักผ่อนสะสม",
  annual_days: "วันลาพักผ่อนประจำปี",
  total_entitlement: "สิทธิลาพักผ่อนรวม (สะสม+ประจำปี)",
  used_before: "ลามาแล้ว (วันทำการ ไม่รวมครั้งนี้)",
  used_total: "ลารวมทั้งสิ้น (วันทำการ รวมครั้งนี้)",
  remaining_days: "วันลาคงเหลือ (วันทำการ)",
  substitute_1: "ผู้ปฏิบัติงานแทน คนที่ 1",
  substitute_2: "ผู้ปฏิบัติงานแทน คนที่ 2",
  substitute_3: "ผู้ปฏิบัติงานแทน คนที่ 3",
  branch_head_opinion: "ความเห็นประธานสาขาวิชา",
  cancel_reason: "เหตุผลการยกเลิกวันลา",
  cancel_request_date: "วันที่ยื่นขอยกเลิก",
};

// ── ใบเดินทางไปราชการ (doc_type='travel') — เทมเพลตเดียวใช้ทุกประเภทการเดินทาง ──
const TRAVEL_PLACEHOLDERS = [
  "full_name", "position", "department", "travel_type", "title", "location",
  "start_date", "end_date", "total_days", "estimated_budget", "actual_budget",
  "today_thai",
];
const TRAVEL_LABELS: Record<string, string> = {
  full_name: "ชื่อ–นามสกุล ผู้เดินทาง",
  position: "ตำแหน่ง",
  department: "สังกัด / หน่วยงาน",
  travel_type: "ประเภทการเดินทาง",
  title: "เรื่อง / หัวข้อการเดินทาง",
  location: "สถานที่ / จังหวัด",
  start_date: "วันที่เริ่มเดินทาง",
  end_date: "วันที่สิ้นสุด",
  total_days: "จำนวนวัน",
  estimated_budget: "งบประมาณโดยประมาณ (รวม)",
  actual_budget: "งบเบิกจ่ายจริง (รวม)",
  today_thai: "วันที่ปัจจุบัน (แบบไทย)",
};

export function DocumentTemplatesSection({
  templates,
  travelTemplates = [],
  canManage,
}: {
  templates: LeaveTemplate[];
  travelTemplates?: LeaveTemplate[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteRow, setDeleteRow] = useState<LeaveTemplate | null>(null);

  function handleUpload(file: File, code: string) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("รองรับเฉพาะไฟล์ Word (.docx)");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("leaveTypeCode", code);
    startTransition(async () => {
      try {
        await uploadLeaveTemplate(fd);
        toast.success("อัปโหลดเทมเพลตแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
      }
    });
  }

  function handleUploadTravel(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("รองรับเฉพาะไฟล์ Word (.docx)");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        await uploadTravelTemplate(fd);
        toast.success("อัปโหลดเทมเพลตแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
      }
    });
  }

  function handleDelete() {
    if (!deleteRow) return;
    const id = deleteRow.id;
    setDeleteRow(null);
    startTransition(async () => {
      try {
        await deleteLeaveTemplate(id);
        toast.success("ลบเทมเพลตแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  async function copyPlaceholder(name: string) {
    const text = `{${name}}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`คัดลอก ${text} แล้ว`);
      return;
    } catch {
      // Clipboard API can be blocked (insecure context / no user-activation) —
      // fall back to the legacy execCommand path.
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) toast.success(`คัดลอก ${text} แล้ว`);
      else toast.error("คัดลอกไม่สำเร็จ");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 space-y-1.5 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-200">
        <div className="font-semibold flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" /> Template เอกสาร DOCX — เติมข้อมูลอัตโนมัติเมื่อดาวน์โหลด
        </div>
        <p>
          อัปโหลดไฟล์ Word ต้นฉบับของแต่ละแบบฟอร์มที่มี placeholder รูปแบบ{" "}
          <code className="font-mono bg-sky-100 px-1 rounded dark:bg-sky-900/40">{"{ชื่อฟิลด์}"}</code>{" "}
          ระบบจะแทนค่าจากใบลาจริงตอนดาวน์โหลด — เอกสารที่ได้จะตรงกับต้นฉบับ ·
          ช่องลายเซ็น ผอ.สำนักงาน/คณบดี/อธิการบดี เว้นว่างไว้
        </p>
      </div>

      {!canManage && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-3 text-sm dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          จัดการเทมเพลตได้เฉพาะผู้ดูแลระบบ (Admin) — แสดงเพื่อดูเท่านั้น
        </div>
      )}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">แบบฟอร์มใบลา</h4>
        {FORM_TYPES.map((ft) => {
          const active = templates.find(
            (t) => (t.leave_type_code ?? "") === ft.code && t.is_active,
          );
          return (
            <TemplateCard
              key={ft.code || "general"}
              formType={ft}
              active={active ?? null}
              placeholders={PLACEHOLDERS_BY_CODE[ft.code] ?? COMMON}
              canManage={canManage}
              isPending={isPending}
              onUpload={handleUpload}
              onRequestDelete={setDeleteRow}
              onCopy={copyPlaceholder}
            />
          );
        })}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">แบบฟอร์มใบเดินทางไปราชการ</h4>
        <TemplateCard
          formType={{ code: "", label: "คำสั่งไปราชการ / ใบเดินทาง" }}
          active={travelTemplates.find((t) => t.is_active) ?? null}
          placeholders={TRAVEL_PLACEHOLDERS}
          labels={TRAVEL_LABELS}
          canManage={canManage}
          isPending={isPending}
          onUpload={(file) => handleUploadTravel(file)}
          onRequestDelete={setDeleteRow}
          onCopy={copyPlaceholder}
        />
      </div>

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title="ยืนยันการลบเทมเพลต"
        description={`ต้องการลบเทมเพลต "${deleteRow?.name ?? ""}" ใช่หรือไม่?`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function TemplateCard({
  formType,
  active,
  placeholders,
  labels = PLACEHOLDER_LABELS,
  canManage,
  isPending,
  onUpload,
  onRequestDelete,
  onCopy,
}: {
  formType: FormType;
  active: LeaveTemplate | null;
  placeholders: string[];
  labels?: Record<string, string>;
  canManage: boolean;
  isPending: boolean;
  onUpload: (file: File, code: string) => void;
  onRequestDelete: (t: LeaveTemplate) => void;
  onCopy: (name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function pick() {
    fileRef.current?.click();
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file, formType.code);
    e.target.value = "";
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          {formType.label}
          {formType.code && (
            <code className="font-mono text-[11px] text-muted-foreground">({formType.code})</code>
          )}
        </h3>
      </div>

      {/* Status / drop area */}
      {active ? (
        <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
          <p className="mt-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Template พร้อมใช้งาน
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">{active.name}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
          <FileUp className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-1.5 text-sm text-muted-foreground">ยังไม่มี Template สำหรับฟอร์มนี้</p>
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={onFile}
            disabled={isPending}
          />
          <Button variant="outline" size="sm" onClick={pick} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {active ? "อัปโหลด Template ใหม่" : "อัปโหลด Template"}
          </Button>
          {active && (
            <Button
              variant="outline" size="sm" className="text-destructive"
              onClick={() => onRequestDelete(active)} disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" /> ลบ Template
            </Button>
          )}
        </div>
      )}

      {/* Placeholder chips — แสดงคำอธิบาย + โค้ด, คลิกคัดลอกเฉพาะ {code} */}
      <div className="rounded-lg bg-muted/40 p-3">
        <p className="text-xs font-medium mb-2">Placeholder ที่รองรับ (คลิกเพื่อคัดลอก):</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {placeholders.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onCopy(p)}
              className="group flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left transition hover:border-primary hover:bg-primary/5"
              title="คลิกเพื่อคัดลอก"
            >
              <span className="flex flex-col">
                <span className="text-[11px] leading-tight text-foreground">
                  {labels[p] ?? p}
                </span>
                <span className="font-mono text-[11px] leading-tight text-primary">{`{${p}}`}</span>
              </span>
              <Copy className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
