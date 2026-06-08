"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getHolidays,
} from "@/lib/actions/holiday-actions";
import { HOLIDAY_TYPES, type HolidayType } from "@/lib/holiday-types";
import {
  performanceCycleRange,
  currentCycle,
  formatThai,
} from "@/lib/date-ranges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Plus, Loader2, CalendarCheck2 } from "lucide-react";
import { toast } from "sonner";
import { HolidayCalendar } from "./_components/holiday-calendar";

interface HolidayRow {
  id: string;
  date: string;
  name: string;
  fiscal_year: number;
  type: string;
  note: string | null;
}

interface Props {
  rows: HolidayRow[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
}

/** หมวดวันหยุด — สี/ป้าย ใช้ร่วมกันทั้ง legend, calendar, badge, select */
const TYPE_META: Record<
  HolidayType,
  { label: string; dot: string; cell: string; badge: string }
> = {
  general: {
    label: "ทั่วไป",
    dot: "bg-rose-500",
    cell: "border-rose-200 bg-rose-50 text-rose-700",
    badge: "border-rose-200 bg-rose-100 text-rose-700",
  },
  own_closure: {
    label: "มหาวิทยาลัยหยุดเอง",
    dot: "bg-blue-500",
    cell: "border-blue-200 bg-blue-50 text-blue-700",
    badge: "border-blue-200 bg-blue-100 text-blue-700",
  },
  special: {
    label: "พิเศษ",
    dot: "bg-emerald-500",
    cell: "border-emerald-200 bg-emerald-50 text-emerald-700",
    badge: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
};

const TYPE_ITEMS = Object.fromEntries(
  HOLIDAY_TYPES.map((t) => [t, TYPE_META[t].label]),
) as Record<HolidayType, string>;

/** Format YYYY-MM-DD to Thai short date "1 ม.ค. 2569" */
function formatThaiDate(iso: string): string {
  return formatThai(iso);
}

/** First displayed month for a round, parsed from its start date. */
function rangeFirstMonth(start: string): { year: number; month: number } {
  const [y, m] = start.split("-").map(Number);
  return { year: y, month: m - 1 };
}

type FormState = {
  date: string;
  name: string;
  type: HolidayType;
  note: string;
};

const EMPTY_FORM: FormState = { date: "", name: "", type: "general", note: "" };

export function HolidaysSection({
  rows: initialRows,
  fiscalYearOptions,
  currentFiscalYear: defaultFy,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rows, setRows] = useState<HolidayRow[]>(initialRows);
  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [half, setHalf] = useState<1 | 2>(currentCycle().half);

  const range = useMemo(
    () => performanceCycleRange(selectedFy, half),
    [selectedFy, half],
  );

  // Calendar position (defaults to first month of the active round)
  const [cal, setCal] = useState(() => rangeFirstMonth(range.start));

  // Dialog (add / edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deleteRow, setDeleteRow] = useState<HolidayRow | null>(null);

  // Holidays within the active FY + round, for the list
  const roundRows = useMemo(
    () =>
      rows
        .filter((r) => r.date >= range.start && r.date <= range.end)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [rows, range.start, range.end],
  );

  // All FY holidays mapped for the calendar (it looks up by displayed month)
  const calHolidays = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        name: r.name,
        type: r.type as HolidayType,
      })),
    [rows],
  );

  // ── Filter changes ──
  function handleFyChange(fy: number) {
    setSelectedFy(fy);
    setCal(rangeFirstMonth(performanceCycleRange(fy, half).start));
    startTransition(async () => {
      try {
        const data = await getHolidays(fy);
        setRows(data as HolidayRow[]);
      } catch {
        toast.error("ดึงข้อมูลวันหยุดไม่สำเร็จ");
      }
    });
  }
  function handleHalfChange(h: 1 | 2) {
    setHalf(h);
    setCal(rangeFirstMonth(performanceCycleRange(selectedFy, h).start));
  }

  // ── Calendar nav ──
  function shiftMonth(delta: number) {
    setCal((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }
  function goToday() {
    const d = new Date();
    setCal({ year: d.getFullYear(), month: d.getMonth() });
  }

  // ── Dialog ──
  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: range.start });
    setDialogOpen(true);
  }
  function openEdit(r: HolidayRow) {
    setEditingId(r.id);
    setForm({
      date: r.date,
      name: r.name,
      type: (r.type as HolidayType) ?? "general",
      note: r.note ?? "",
    });
    setDialogOpen(true);
  }

  function refresh(fy: number) {
    startTransition(async () => {
      try {
        const data = await getHolidays(fy);
        setRows(data as HolidayRow[]);
        router.refresh(); // keep tab count badge in sync
      } catch {
        /* list already optimistic-free; ignore */
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.name.trim()) {
      toast.error("กรุณากรอกวันที่และชื่อวันหยุด");
      return;
    }
    const payload = {
      date: form.date,
      name: form.name.trim(),
      type: form.type,
      note: form.note.trim() || null,
    };
    // Plain async (not a transition) so the dialog closes immediately on
    // success — a transition update would defer the close behind refresh().
    setSubmitting(true);
    try {
      if (editingId) {
        await updateHoliday(editingId, payload);
        toast.success("บันทึกการแก้ไขแล้ว");
      } else {
        await createHoliday(payload);
        toast.success("เพิ่มวันหยุดราชการแล้ว");
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
        await deleteHoliday(id);
        toast.success("ลบวันหยุดราชการแล้ว");
        refresh(selectedFy);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  const fyItems = useMemo(
    () =>
      Object.fromEntries(
        fiscalYearOptions.map((fy) => [String(fy), String(fy + 543)]),
      ),
    [fiscalYearOptions],
  );
  const halfItems = { "1": "รอบที่ 1", "2": "รอบที่ 2" };

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-rose-100 text-rose-600 p-2">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base">วันหยุดราชการ</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                ข้อมูลปีงบประมาณ {selectedFy + 543} ({formatThai(range.start)} – {formatThai(range.end)})
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
            <Select
              items={halfItems}
              value={String(half)}
              onValueChange={(v) => v && handleHalfChange(Number(v) as 1 | 2)}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">รอบที่ 1</SelectItem>
                <SelectItem value="2">รอบที่ 2</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openAdd} disabled={isPending}>
              <Plus className="h-4 w-4 mr-1.5" />
              เพิ่มวันหยุด
            </Button>
          </div>
        </div>
      </div>

      {/* ── Calendar ── */}
      <HolidayCalendar
        year={cal.year}
        month={cal.month}
        holidays={calHolidays}
        typeMeta={TYPE_META}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={goToday}
      />

      {/* ── List ── */}
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">รายการวันหยุด</h3>
          <span className="text-xs text-muted-foreground">{roundRows.length} วัน</span>
        </div>
        {roundRows.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
            ยังไม่มีวันหยุดราชการในรอบนี้
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {roundRows.map((row) => {
              const meta = TYPE_META[(row.type as HolidayType) ?? "general"];
              return (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{row.name}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[0.7rem]", meta.badge)}
                      >
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      วันที่ {formatThaiDate(row.date)}
                    </p>
                    {row.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>
                    )}
                  </div>
                  <div className="inline-flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEdit(row)}
                      disabled={isPending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteRow(row)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "แก้ไขวันหยุดราชการ" : "เพิ่มวันหยุดราชการ"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="holDate" className="text-xs">วันที่ *</Label>
              <ThaiDatePicker
                id="holDate"
                value={form.date}
                onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holName" className="text-xs">ชื่อวันหยุด *</Label>
              <Input
                id="holName"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="เช่น วันสงกรานต์"
                disabled={submitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">หมวดวันหยุด *</Label>
              <Select
                items={TYPE_ITEMS}
                value={form.type}
                onValueChange={(v) =>
                  v && setForm((f) => ({ ...f, type: v as HolidayType }))
                }
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLIDAY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", TYPE_META[t].dot)} />
                        {TYPE_META[t].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holNote" className="text-xs">หมายเหตุ (ถ้ามี)</Label>
              <textarea
                id="holNote"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                maxLength={500}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="เช่น เนื่องจากวันจันทร์และวันพุธเป็นวันหยุด"
                disabled={submitting}
              />
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
              <Button type="submit" disabled={submitting || !form.date || !form.name.trim()}>
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
        title="ยืนยันการลบวันหยุดราชการ"
        description={`ต้องการลบ "${deleteRow?.name ?? ""}" (${deleteRow ? formatThaiDate(deleteRow.date) : ""}) ใช่หรือไม่?`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
