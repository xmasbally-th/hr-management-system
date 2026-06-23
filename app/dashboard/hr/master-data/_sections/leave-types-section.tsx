"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeaveType } from "@/lib/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Loader2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";

interface LeaveTypeRow {
  id: string;
  name: string;
  code?: string | null;
  max_days_per_year: number;
}

const CODE_COLORS: Record<string, string> = {
  SICK: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  PERSONAL: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  VACATION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  MATERNITY: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
};

export function LeaveTypesSection({ rows }: { rows: LeaveTypeRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMax, setEditMax] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  function startEdit(r: LeaveTypeRow) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditMax(String(r.max_days_per_year ?? 0));
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditMax("");
  }
  function saveEdit() {
    if (!editingId) return;
    const days = Number.parseInt(editMax, 10);
    if (!editName.trim() || !Number.isInteger(days) || days < 0) {
      toast.error("ข้อมูลไม่ถูกต้อง");
      return;
    }
    const id = editingId;
    startTransition(async () => {
      try {
        await updateLeaveType(id, { name: editName, max_days_per_year: days });
        toast.success("บันทึกการแก้ไขแล้ว");
        cancelEdit();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 border border-border rounded-lg p-4 bg-sky-50 border-sky-200 h-fit">
        <h3 className="font-semibold mb-2 text-sm text-sky-900">ระบบล็อก 4 ประเภทลา</h3>
        <p className="text-xs text-sky-900 leading-relaxed">
          ประเภทการลาในระบบเป็นไปตามระเบียบราชการ (ป่วย / กิจ / พักผ่อน / คลอด) —
          แก้ไขได้เฉพาะ <b>ชื่อแสดง</b> และ <b>จำนวนวันสูงสุด/ปี</b> ของแต่ละประเภท
          ไม่อนุญาตให้เพิ่ม/ลบประเภทใหม่
        </p>
      </div>

      <div className="md:col-span-2 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`ค้นหาในรายการ (${rows.length} รายการ)`}
            className="pl-9"
          />
        </div>

        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ประเภทการลา</TableHead>
                <TableHead className="w-[100px]">รหัส</TableHead>
                <TableHead className="text-center w-[140px]">วันสูงสุด/ปี</TableHead>
                <TableHead className="w-[140px] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                    {search ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีประเภทการลา"}
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
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            disabled={isPending}
                          />
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.code ? (
                          <Badge
                            variant="secondary"
                            className={CODE_COLORS[row.code] ?? ""}
                          >
                            {row.code}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            value={editMax}
                            onChange={(e) => setEditMax(e.target.value)}
                            className="h-9 w-24 text-center mx-auto"
                            disabled={isPending}
                          />
                        ) : (
                          <span className="font-mono">{row.max_days_per_year ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600"
                              aria-label="บันทึก" onClick={saveEdit}
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
                              aria-label="ยกเลิก" onClick={cancelEdit}
                              disabled={isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="แก้ไข" onClick={() => startEdit(row)}
                            disabled={isPending}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
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

    </div>
  );
}
