"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createExamPeriod,
  updateExamPeriod,
  deleteExamPeriod,
  getExamPeriods,
} from "@/lib/actions/exam-period-actions";
import { updateExamDutyPositions } from "@/lib/actions/settings-actions";
import { formatThai } from "@/lib/date-ranges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pencil, Trash2, Plus, Loader2, CalendarClock, X } from "lucide-react";
import { toast } from "sonner";

interface ExamPeriodRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  fiscal_year: number;
}

interface Props {
  rows: ExamPeriodRow[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
  dutyPositions: string[];
}

type FormState = { name: string; start: string; end: string };
const EMPTY_FORM: FormState = { name: "", start: "", end: "" };

export function ExamPeriodsSection({
  rows: initialRows,
  fiscalYearOptions,
  currentFiscalYear: defaultFy,
  dutyPositions: initialDuty,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<ExamPeriodRow[]>(initialRows);
  const [selectedFy, setSelectedFy] = useState(defaultFy);

  // Dialog (add / edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteRow, setDeleteRow] = useState<ExamPeriodRow | null>(null);

  // Duty positions editor
  const [duty, setDuty] = useState<string[]>(initialDuty);
  const [dutyInput, setDutyInput] = useState("");
  const [savingDuty, setSavingDuty] = useState(false);
  const dutyDirty = useMemo(
    () => JSON.stringify(duty) !== JSON.stringify(initialDuty),
    [duty, initialDuty],
  );

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [rows],
  );

  function refresh(fy: number) {
    startTransition(async () => {
      try {
        const data = await getExamPeriods(fy);
        setRows(data as ExamPeriodRow[]);
        router.refresh();
      } catch {
        /* ignore */
      }
    });
  }

  function handleFyChange(fy: number) {
    setSelectedFy(fy);
    startTransition(async () => {
      try {
        setRows((await getExamPeriods(fy)) as ExamPeriodRow[]);
      } catch {
        toast.error("ดึงข้อมูลช่วงสอบไม่สำเร็จ");
      }
    });
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }
  function openEdit(r: ExamPeriodRow) {
    setEditingId(r.id);
    setForm({ name: r.name, start: r.start_date, end: r.end_date });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.start || !form.end) {
      toast.error("กรุณากรอกชื่อ วันเริ่ม และวันสิ้นสุด");
      return;
    }
    if (form.end < form.start) {
      toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await updateExamPeriod(editingId, {
          name: form.name.trim(),
          start_date: form.start,
          end_date: form.end,
        });
        toast.success("บันทึกการแก้ไขแล้ว");
      } else {
        await createExamPeriod({
          name: form.name.trim(),
          start_date: form.start,
          end_date: form.end,
        });
        toast.success("เพิ่มช่วงสอบแล้ว");
      }
      setDialogOpen(false);
      refresh(selectedFy);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    if (!deleteRow) return;
    const id = deleteRow.id;
    setDeleteRow(null);
    startTransition(async () => {
      try {
        await deleteExamPeriod(id);
        toast.success("ลบช่วงสอบแล้ว");
        refresh(selectedFy);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  // ── Duty positions ──
  function addDuty() {
    const v = dutyInput.trim();
    if (!v) return;
    if (duty.some((d) => d.toLowerCase() === v.toLowerCase())) {
      setDutyInput("");
      return;
    }
    setDuty((d) => [...d, v]);
    setDutyInput("");
  }
  function removeDuty(idx: number) {
    setDuty((d) => d.filter((_, i) => i !== idx));
  }
  async function saveDuty() {
    setSavingDuty(true);
    try {
      await updateExamDutyPositions(duty);
      toast.success("บันทึกรายการตำแหน่งแล้ว");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingDuty(false);
    }
  }

  const fyItems = useMemo(
    () =>
      Object.fromEntries(
        fiscalYearOptions.map((fy) => [String(fy), String(fy + 543)]),
      ),
    [fiscalYearOptions],
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 text-amber-600 p-2">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">ช่วงสอบปลายภาค</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                ใช้แจ้งเตือนภาระคุมสอบบนฟอร์มขอเดินทาง/ลาพักผ่อน (แจ้งเตือนอย่างเดียว ไม่บล็อก)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={fyItems}
              value={String(selectedFy)}
              onValueChange={(v) => v && handleFyChange(Number(v))}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearOptions.map((fy) => (
                  <SelectItem key={fy} value={String(fy)}>
                    ปีงบ {fy + 543}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={openAdd} disabled={isPending}>
              <Plus className="h-4 w-4 mr-1.5" />
              เพิ่มช่วงสอบ
            </Button>
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">รายการช่วงสอบ ปีงบ {selectedFy + 543}</h3>
          <span className="text-xs text-muted-foreground">{sorted.length} ช่วง</span>
        </div>
        {sorted.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            ยังไม่มีช่วงสอบในปีงบประมาณนี้
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((row) => (
              <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{row.name}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatThai(row.start_date)} – {formatThai(row.end_date)}
                  </p>
                </div>
                <div className="inline-flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="แก้ไข"
                    onClick={() => openEdit(row)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="ลบ" onClick={() => setDeleteRow(row)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Duty positions editor ── */}
      <div className="border border-border rounded-lg bg-card p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">ตำแหน่งที่มีภาระคุมสอบ</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            พนักงานที่ตำแหน่ง (position_title) มีคำเหล่านี้ จะเห็นคำเตือนเมื่อขอเดินทาง/ลาพักผ่อนช่วงสอบ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {duty.length === 0 ? (
            <span className="text-xs text-muted-foreground">ยังไม่มีตำแหน่ง</span>
          ) : (
            duty.map((d, i) => (
              <Badge key={`${d}-${i}`} variant="secondary" className="gap-1 pr-1">
                {d}
                <button
                  type="button"
                  onClick={() => removeDuty(i)}
                  className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                  aria-label={`ลบ ${d}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={dutyInput}
            onChange={(e) => setDutyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDuty();
              }
            }}
            placeholder="เช่น อาจารย์"
            className="h-9 max-w-xs"
            disabled={savingDuty}
          />
          <Button variant="outline" size="sm" onClick={addDuty} disabled={savingDuty || !dutyInput.trim()}>
            เพิ่ม
          </Button>
          <Button size="sm" onClick={saveDuty} disabled={savingDuty || !dutyDirty} className="ml-auto">
            {savingDuty && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            บันทึกรายการ
          </Button>
        </div>
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "แก้ไขช่วงสอบ" : "เพิ่มช่วงสอบ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="examName" className="text-xs">ชื่อช่วงสอบ *</Label>
              <Input
                id="examName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น สอบปลายภาค 1/2569"
                disabled={submitting}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">วันเริ่ม *</Label>
                <ThaiDatePicker
                  value={form.start}
                  onChange={(v) => setForm((f) => ({ ...f, start: v }))}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">วันสิ้นสุด *</Label>
                <ThaiDatePicker
                  value={form.end}
                  onChange={(v) => setForm((f) => ({ ...f, end: v }))}
                  disabled={submitting}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={submitting || !form.name.trim() || !form.start || !form.end}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? "บันทึก" : "เพิ่ม"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title="ยืนยันการลบช่วงสอบ"
        description={`ต้องการลบ "${deleteRow?.name ?? ""}" ใช่หรือไม่?`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
