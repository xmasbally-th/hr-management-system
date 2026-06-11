"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadLeaveTemplate,
  setLeaveTemplateActive,
  deleteLeaveTemplate,
  type LeaveTemplate,
} from "@/lib/actions/template-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Upload, Loader2, Trash2, CheckCircle2, FileText, Power } from "lucide-react";
import { toast } from "sonner";

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "ทั่วไป (ใช้เมื่อไม่มีเทมเพลตเฉพาะประเภท)" },
  { value: "SICK", label: "ลาป่วย (SICK)" },
  { value: "PERSONAL", label: "ลากิจ (PERSONAL)" },
  { value: "VACATION", label: "ลาพักผ่อน (VACATION)" },
  { value: "MATERNITY", label: "ลาคลอด (MATERNITY)" },
  { value: "CANCELLATION", label: "ใบขอยกเลิกวันลา (CANCELLATION)" },
];

const PLACEHOLDERS = [
  "title_th", "full_name", "position", "department",
  "leave_type", "start_date", "end_date", "total_days", "working_days",
  "reason", "contact", "edd",
  "accumulated_days", "annual_days", "substitute_1", "substitute_2",
  "substitute_3", "branch_head_opinion", "today_thai",
  // ใบขอยกเลิกวันลา (CANCELLATION) เพิ่ม:
  "cancel_reason", "cancel_request_date",
];

function typeLabel(code: string | null): string {
  return TYPE_OPTIONS.find((o) => o.value === (code ?? ""))?.label ?? code ?? "ทั่วไป";
}

export function DocumentTemplatesSection({
  templates,
  canManage,
}: {
  templates: LeaveTemplate[];
  canManage: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [deleteRow, setDeleteRow] = useState<LeaveTemplate | null>(null);

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("กรุณาเลือกไฟล์ .docx");
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    fd.set("leaveTypeCode", code);
    startTransition(async () => {
      try {
        await uploadLeaveTemplate(fd);
        toast.success("อัปโหลดเทมเพลตแล้ว");
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
      }
    });
  }

  function handleToggle(t: LeaveTemplate) {
    startTransition(async () => {
      try {
        await setLeaveTemplateActive(t.id, !t.is_active);
        toast.success(t.is_active ? "ปิดใช้งานเทมเพลตแล้ว" : "เปิดใช้งานเทมเพลตแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 space-y-2">
        <div className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> เทมเพลตใบลา (.docx) — เติมข้อมูลอัตโนมัติเมื่อดาวน์โหลด
        </div>
        <p>
          อัปโหลดแบบฟอร์มใบลา Word ที่มี placeholder ในรูปแบบ{" "}
          <code className="font-mono bg-sky-100 px-1 rounded">{"{ชื่อฟิลด์}"}</code>{" "}
          ระบบจะแทนค่าจากใบลาจริงตอน HR กดดาวน์โหลด · ช่องลายเซ็น ผอ./คณบดี/อธิการบดี เว้นว่างไว้
        </p>
        <div className="flex flex-wrap gap-1">
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="font-mono bg-sky-100 px-1.5 py-0.5 rounded text-[11px]">
              {`{${p}}`}
            </code>
          ))}
        </div>
      </div>

      {!canManage && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 p-3 text-sm">
          จัดการเทมเพลตได้เฉพาะผู้ดูแลระบบ (Admin) — แสดงเพื่อดูเท่านั้น
        </div>
      )}

      {canManage && (
        <form onSubmit={handleUpload} className="border border-border rounded-lg p-4 bg-card space-y-3">
          <h3 className="font-semibold text-sm">อัปโหลดเทมเพลต</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">ประเภทการลา</Label>
              <select
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isPending}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ไฟล์ .docx (≤ 5 MB)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={isPending}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            อัปโหลด
          </Button>
        </form>
      )}

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>ชื่อไฟล์</TableHead>
              <TableHead className="w-[110px]">สถานะ</TableHead>
              {canManage && <TableHead className="w-[120px] text-right">จัดการ</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="h-24 text-center text-muted-foreground text-sm">
                  ยังไม่มีเทมเพลต — อัปโหลดแบบฟอร์มใบลา .docx เพื่อใช้งาน
                </TableCell>
              </TableRow>
            ) : (
              templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{typeLabel(t.leave_type_code)}</TableCell>
                  <TableCell className="text-sm font-mono">{t.name}</TableCell>
                  <TableCell>
                    {t.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> ใช้งาน
                      </Badge>
                    ) : (
                      <Badge variant="secondary">ปิด</Badge>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          title={t.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                          onClick={() => handleToggle(t)} disabled={isPending}
                        >
                          <Power className={`h-3.5 w-3.5 ${t.is_active ? "text-emerald-600" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteRow(t)} disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
