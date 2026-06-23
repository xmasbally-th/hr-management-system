"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createAttendancePeriod,
  deleteAttendancePeriod,
  setAttendancePeriodStatus,
} from "@/lib/actions/attendance-actions";
import { periodLabel, thaiMonth, fiscalYearLabel } from "@/lib/attendance/labels";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Plus,
  Loader2,
  Trash2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

interface PeriodRow {
  id: string;
  department_id: string;
  period_type: "monthly" | "annual";
  buddhist_year: number;
  month: number | null;
  working_days: number | null;
  start_date: string | null;
  end_date: string | null;
  title: string | null;
  status: "draft" | "published";
  source_file_url: string | null;
  created_at: string;
  department: { name: string } | { name: string }[] | null;
  entries: { count: number }[] | null;
}

function periodRowLabel(p: {
  period_type: "monthly" | "annual";
  month: number | null;
  buddhist_year: number;
}): string {
  return p.period_type === "annual"
    ? fiscalYearLabel(p.buddhist_year)
    : periodLabel(p.month ?? 0, p.buddhist_year);
}

interface Props {
  periods: PeriodRow[];
  canManage: boolean;
}

const CURRENT_BE_YEAR = new Date().getFullYear() + 543;

function deptName(d: PeriodRow["department"]): string {
  if (!d) return "—";
  if (Array.isArray(d)) return d[0]?.name ?? "—";
  return d.name;
}

function entryCount(e: PeriodRow["entries"]): number {
  return e?.[0]?.count ?? 0;
}

export function AttendanceListClient({ periods, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteRow, setDeleteRow] = useState<PeriodRow | null>(null);

  const [form, setForm] = useState({
    period_type: "monthly" as "monthly" | "annual",
    buddhist_year: String(CURRENT_BE_YEAR),
    month: String(new Date().getMonth() + 1),
    working_days: "",
    start_date: "",
    end_date: "",
  });

  const monthItems = useMemo(
    () => Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i + 1), thaiMonth(i + 1)])),
    [],
  );

  // Group periods by Buddhist year for a tidy list.
  const grouped = useMemo(() => {
    const map = new Map<number, PeriodRow[]>();
    for (const p of periods) {
      const arr = map.get(p.buddhist_year) ?? [];
      arr.push(p);
      map.set(p.buddhist_year, arr);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [periods]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const annual = form.period_type === "annual";
    const wd = Number(form.working_days);
    if (!annual && (!Number.isFinite(wd) || wd <= 0 || wd > 31))
      return toast.error("กรอกจำนวนวันทำงานของเดือน (1–31)");
    if (annual && form.start_date && form.end_date && form.end_date < form.start_date)
      return toast.error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");

    setSubmitting(true);
    try {
      const created = await createAttendancePeriod(
        annual
          ? {
              period_type: "annual",
              buddhist_year: Number(form.buddhist_year),
              start_date: form.start_date || undefined,
              end_date: form.end_date || undefined,
            }
          : {
              period_type: "monthly",
              buddhist_year: Number(form.buddhist_year),
              month: Number(form.month),
              working_days: wd,
            },
      );
      toast.success("สร้างรอบสรุปแล้ว — อัปโหลด PDF เพื่อนำเข้าข้อมูล");
      setCreateOpen(false);
      router.push(`/dashboard/hr/attendance/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "สร้างรอบไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  function togglePublish(p: PeriodRow) {
    const next = p.status === "published" ? "draft" : "published";
    startTransition(async () => {
      try {
        await setAttendancePeriodStatus(p.id, next);
        toast.success(next === "published" ? "เผยแพร่แล้ว" : "ยกเลิกการเผยแพร่แล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "อัปเดตสถานะไม่สำเร็จ");
      }
    });
  }

  function handleDelete() {
    if (!deleteRow) return;
    const id = deleteRow.id;
    setDeleteRow(null);
    startTransition(async () => {
      try {
        await deleteAttendancePeriod(id);
        toast.success("ลบรอบสรุปแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Link
          href="/dashboard/hr/attendance/reports"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <BarChart3 className="h-4 w-4 mr-1.5" />
          รายงาน
        </Link>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            สร้างรอบใหม่
          </Button>
        )}
      </div>

      {periods.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg bg-card py-16 flex flex-col items-center justify-center text-center gap-2">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            ยังไม่มีข้อมูลสรุปการมาปฏิบัติงาน
          </p>
          {canManage && (
            <p className="text-xs text-muted-foreground">
              กด “สร้างรอบใหม่” แล้วอัปโหลดไฟล์ PDF ที่ HR มหาวิทยาลัยส่งมา
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, rows]) => (
            <div key={year} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground px-1">พ.ศ. {year}</h2>
              <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
                {rows
                  .sort((a, b) => {
                    // annual first, then months descending
                    if (a.period_type !== b.period_type)
                      return a.period_type === "annual" ? -1 : 1;
                    return (b.month ?? 0) - (a.month ?? 0);
                  })
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="rounded-lg bg-primary/10 text-primary p-2 shrink-0">
                        <ClipboardCheck className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/dashboard/hr/attendance/${p.id}`}
                            className="font-medium hover:underline"
                          >
                            {periodRowLabel(p)}
                          </Link>
                          {p.period_type === "annual" && (
                            <Badge variant="outline">รายปี</Badge>
                          )}
                          <Badge variant={p.status === "published" ? "default" : "secondary"}>
                            {p.status === "published" ? "เผยแพร่แล้ว" : "ร่าง"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                          <span>{deptName(p.department)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {entryCount(p.entries)} คน
                          </span>
                          {p.period_type === "monthly" && (
                            <span>วันทำงาน {p.working_days ?? "-"} วัน</span>
                          )}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1 shrink-0">
                        {canManage && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePublish(p)}
                            disabled={isPending}
                            title={p.status === "published" ? "ยกเลิกการเผยแพร่" : "เผยแพร่"}
                          >
                            {p.status === "published" ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            aria-label="ลบรายการ"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteRow(p)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Link
                          href={`/dashboard/hr/attendance/${p.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
                          aria-label="เปิดรอบสรุป"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สร้างรอบสรุปการมาปฏิบัติงาน</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            {/* ชนิดรอบ */}
            <div className="space-y-1.5">
              <Label className="text-xs">ชนิดรอบ *</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "monthly", label: "รายเดือน" },
                    { v: "annual", label: "รายปีงบประมาณ" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, period_type: opt.v }))}
                    disabled={submitting}
                    className={cn(
                      "h-9 rounded-lg border text-sm font-medium transition-colors",
                      form.period_type === opt.v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {form.period_type === "monthly" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">เดือน *</Label>
                  <Select
                    items={monthItems}
                    value={form.month}
                    onValueChange={(v) => v && setForm((f) => ({ ...f, month: String(v) }))}
                    disabled={submitting}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {thaiMonth(i + 1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="beYear" className="text-xs">
                  {form.period_type === "annual" ? "ปีงบประมาณ (พ.ศ.) *" : "ปี (พ.ศ.) *"}
                </Label>
                <Input
                  id="beYear"
                  type="number"
                  min={2500}
                  max={2700}
                  value={form.buddhist_year}
                  onChange={(e) => setForm((f) => ({ ...f, buddhist_year: e.target.value }))}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {form.period_type === "monthly" ? (
              <div className="space-y-1.5">
                <Label htmlFor="workingDays" className="text-xs">
                  จำนวนวันทำงานของเดือน (คอลัมน์ “รวม”) *
                </Label>
                <Input
                  id="workingDays"
                  type="number"
                  min={1}
                  max={31}
                  value={form.working_days}
                  onChange={(e) => setForm((f) => ({ ...f, working_days: e.target.value }))}
                  placeholder="เช่น 20"
                  disabled={submitting}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">วันเริ่มช่วง</Label>
                  <ThaiDatePicker
                    value={form.start_date}
                    onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">วันสิ้นสุดช่วง</Label>
                  <ThaiDatePicker
                    value={form.end_date}
                    onChange={(v) => setForm((f) => ({ ...f, end_date: v }))}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={submitting || (form.period_type === "monthly" && !form.working_days)}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                สร้างและไปหน้านำเข้า
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title="ยืนยันการลบรอบสรุป"
        description={
          deleteRow
            ? `ต้องการลบรอบ "${periodRowLabel(deleteRow)}" และข้อมูลรายคนทั้งหมดในรอบนี้ใช่หรือไม่?`
            : ""
        }
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
