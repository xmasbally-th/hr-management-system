"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from "@/lib/actions/holiday-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Check,
  X,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

interface HolidayRow {
  id: string;
  date: string;
  name: string;
  fiscal_year: number;
}

interface Props {
  rows: HolidayRow[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
}

/** Format YYYY-MM-DD to Thai short date "1 ม.ค. 2569" */
function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** Day-of-week label */
function dayLabel(iso: string): string {
  const days = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  return days[new Date(iso).getDay()];
}

export function HolidaysSection({ rows, fiscalYearOptions, currentFiscalYear: defaultFy }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [deleteRow, setDeleteRow] = useState<HolidayRow | null>(null);

  // Filter rows by selected FY (server already filters, but handle client switching)
  const filtered = useMemo(
    () => rows.filter((r) => r.fiscal_year === selectedFy),
    [rows, selectedFy],
  );

  // ── Add ──
  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newName.trim()) return;
    startTransition(async () => {
      try {
        await createHoliday({ date: newDate, name: newName.trim() });
        toast.success("เพิ่มวันหยุดราชการแล้ว");
        setNewDate("");
        setNewName("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "เพิ่มไม่สำเร็จ");
      }
    });
  }

  // ── Edit ──
  function startEdit(r: HolidayRow) {
    setEditingId(r.id);
    setEditDate(r.date);
    setEditName(r.name);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditDate("");
    setEditName("");
  }
  function saveEdit() {
    if (!editingId || !editDate || !editName.trim()) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    const id = editingId;
    startTransition(async () => {
      try {
        await updateHoliday(id, { date: editDate, name: editName.trim() });
        toast.success("บันทึกการแก้ไขแล้ว");
        cancelEdit();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  // ── Delete ──
  function handleDelete() {
    if (!deleteRow) return;
    const id = deleteRow.id;
    setDeleteRow(null);
    startTransition(async () => {
      try {
        await deleteHoliday(id);
        toast.success("ลบวันหยุดราชการแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* ── Left: Add form ── */}
      <div className="md:col-span-1 space-y-4">
        <div className="border border-border rounded-lg p-4 bg-card h-fit">
          <h3 className="font-semibold mb-4 text-sm">เพิ่มวันหยุดราชการ</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="holDate" className="text-xs">วันที่ *</Label>
              <Input
                id="holDate"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="holName" className="text-xs">ชื่อวันหยุด *</Label>
              <Input
                id="holName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="เช่น วันสงกรานต์"
                disabled={isPending}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !newDate || !newName.trim()}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              เพิ่ม
            </Button>
          </form>
        </div>
      </div>

      {/* ── Right: Table ── */}
      <div className="md:col-span-2 space-y-3">
        {/* FY selector + count */}
        <div className="flex items-center gap-3">
          <Label htmlFor="fySelect" className="text-sm whitespace-nowrap">ปีงบประมาณ</Label>
          <select
            id="fySelect"
            value={selectedFy}
            onChange={(e) => setSelectedFy(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {fiscalYearOptions.map((fy) => (
              <option key={fy} value={fy}>
                {fy + 543}
              </option>
            ))}
          </select>

          <Badge variant="secondary" className="ml-auto">
            <CalendarDays className="h-3 w-3 mr-1" />
            {filtered.length} วันหยุด
          </Badge>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[160px]">วันที่</TableHead>
                <TableHead className="w-[100px]">วัน</TableHead>
                <TableHead>ชื่อวันหยุด</TableHead>
                <TableHead className="w-[120px] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                    ยังไม่มีวันหยุดราชการในปีงบประมาณนี้
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            disabled={isPending}
                            className="h-9"
                          />
                        ) : (
                          <span className="font-mono text-sm">{formatThaiDate(row.date)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!isEditing && (
                          <span className="text-muted-foreground text-sm">
                            {dayLabel(row.date)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={isPending}
                            className="h-9"
                          />
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600"
                              onClick={saveEdit}
                              disabled={isPending}
                            >
                              {isPending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEdit}
                              disabled={isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => startEdit(row)}
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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
