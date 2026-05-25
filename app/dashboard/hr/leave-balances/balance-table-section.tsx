"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLeaveBalance } from "@/lib/actions/leave-actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Save, Search, Users } from "lucide-react";
import { toast } from "sonner";

// D1: Shape returned by getAllLeaveBalancesForFY — Supabase nested-select
// results are typed loosely, so we declare the fields we actually consume.
interface BalanceRow {
  id: string;
  total_days: number;
  used_days: number;
  accumulated_days: number;
  fiscal_year: number;
  employee:
    | {
        id: string;
        full_name: string | null;
        email: string | null;
        employee_type: string | null;
      }
    | { id: string; full_name: string | null; email: string | null; employee_type: string | null }[]
    | null;
  leave_type:
    | { id: string; name: string | null; code: string | null }
    | { id: string; name: string | null; code: string | null }[]
    | null;
}

interface Props {
  balances: BalanceRow[];
  fiscalYear: number;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export function BalanceTableSection({ balances, fiscalYear }: Props) {
  const router = useRouter();
  const [isSaving, startSave] = useTransition();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BalanceRow | null>(null);
  const [editTotal, setEditTotal] = useState("");
  const [editUsed, setEditUsed] = useState("");
  const [editAccumulated, setEditAccumulated] = useState("");

  // Group rows by employee for a wide table (one row per employee, one column
  // per leave_type). Falls back to per-row when names are missing.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: { id: string; full_name: string; email: string; employee_type: string | null };
        cells: Record<string, BalanceRow>; // by leave_type.code
      }
    >();
    for (const b of balances) {
      const emp = pickOne(b.employee);
      const lt = pickOne(b.leave_type);
      if (!emp || !lt) continue;
      const key = emp.id;
      if (!map.has(key)) {
        map.set(key, {
          employee: {
            id: emp.id,
            full_name: emp.full_name ?? "(ไม่ระบุชื่อ)",
            email: emp.email ?? "",
            employee_type: emp.employee_type ?? null,
          },
          cells: {},
        });
      }
      map.get(key)!.cells[lt.code ?? lt.name ?? lt.id] = b;
    }
    return Array.from(map.values());
  }, [balances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;
    return grouped.filter(
      (g) =>
        g.employee.full_name.toLowerCase().includes(q) ||
        g.employee.email.toLowerCase().includes(q) ||
        (g.employee.employee_type ?? "").toLowerCase().includes(q),
    );
  }, [grouped, search]);

  // Distinct leave-type columns across all rows (preserve a stable order)
  const COL_ORDER = ["SICK", "PERSONAL", "VACATION", "MATERNITY"];
  const columns = useMemo(() => {
    const seen = new Set<string>();
    for (const g of grouped) for (const k of Object.keys(g.cells)) seen.add(k);
    return COL_ORDER.filter((c) => seen.has(c)).concat(
      Array.from(seen).filter((c) => !COL_ORDER.includes(c)),
    );
  }, [grouped]);

  function openEdit(b: BalanceRow) {
    setEditing(b);
    setEditTotal(String(b.total_days));
    setEditUsed(String(b.used_days));
    setEditAccumulated(String(b.accumulated_days));
  }
  function closeEdit() {
    setEditing(null);
  }
  function saveEdit() {
    if (!editing) return;
    const total = Number.parseFloat(editTotal);
    const used = Number.parseFloat(editUsed);
    const accumulated = Number.parseFloat(editAccumulated);
    if (![total, used, accumulated].every((n) => Number.isFinite(n) && n >= 0)) {
      toast.error("กรุณากรอกตัวเลขที่ถูกต้อง (≥ 0)");
      return;
    }
    startSave(async () => {
      try {
        await updateLeaveBalance(editing.id, {
          total_days: total,
          used_days: used,
          accumulated_days: accumulated,
        });
        toast.success("บันทึกแล้ว");
        closeEdit();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  const editingLt = editing ? pickOne(editing.leave_type) : null;
  const editingEmp = editing ? pickOne(editing.employee) : null;

  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-sky-600" />
          <h3 className="font-semibold text-base">
            ยอดวันลาพนักงาน — ปีงบประมาณ {fiscalYear}
          </h3>
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} คน · {balances.length} รายการ
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ / อีเมล / ประเภทบุคลากร"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="min-w-[180px]">พนักงาน</TableHead>
              <TableHead className="min-w-[120px]">ประเภทบุคลากร</TableHead>
              {columns.map((c) => (
                <TableHead key={c} className="text-center min-w-[120px]">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2 + columns.length}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  {search
                    ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข"
                    : "ยังไม่มียอดวันลาในปีงบประมาณนี้ — กดปุ่มตั้งต้นสิทธิ์ด้านบน"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((g) => (
                <TableRow key={g.employee.id}>
                  <TableCell>
                    <div className="font-medium">{g.employee.full_name}</div>
                    <div className="text-xs text-muted-foreground">{g.employee.email}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {g.employee.employee_type ?? "—"}
                  </TableCell>
                  {columns.map((c) => {
                    const b = g.cells[c];
                    if (!b) {
                      return (
                        <TableCell key={c} className="text-center text-muted-foreground text-xs">
                          —
                        </TableCell>
                      );
                    }
                    const remaining = Math.max(0, b.total_days - b.used_days);
                    return (
                      <TableCell key={c} className="text-center">
                        <div className="font-mono text-sm">
                          {remaining} <span className="text-muted-foreground text-xs">/{b.total_days}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          <span className="text-[0.65rem] text-muted-foreground">
                            ใช้ {b.used_days}
                            {b.accumulated_days > 0 ? ` · สะสม ${b.accumulated_days}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEdit(b)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="แก้ไข"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขยอดวันลา</DialogTitle>
            <DialogDescription>
              {editingEmp?.full_name ?? "-"} · {editingLt?.name ?? editingLt?.code ?? "-"} ·{" "}
              ปีงบประมาณ {editing?.fiscal_year}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">สิทธิ์รวม (วัน)</Label>
              <Input
                type="number"
                min={0}
                max={9999}
                step="0.5"
                value={editTotal}
                onChange={(e) => setEditTotal(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ใช้ไป (วัน)</Label>
              <Input
                type="number"
                min={0}
                max={9999}
                step="0.5"
                value={editUsed}
                onChange={(e) => setEditUsed(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">สะสม (วัน)</Label>
              <Input
                type="number"
                min={0}
                max={9999}
                step="0.5"
                value={editAccumulated}
                onChange={(e) => setEditAccumulated(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            การเปลี่ยนแปลงจะถูกบันทึกใน audit log (action: <code>edit_leave_balance</code>)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={isSaving}>
              ยกเลิก
            </Button>
            <Button onClick={saveEdit} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
