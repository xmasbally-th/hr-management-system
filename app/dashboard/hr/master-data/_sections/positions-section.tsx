"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPosition,
  updatePosition,
  deletePosition,
} from "@/lib/actions/master-data-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pencil, Trash2, Plus, Loader2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";

interface PosRow {
  id: string;
  name: string;
  department_id: string;
  department?: { name: string } | null;
}

interface DeptOption {
  id: string;
  name: string;
}

export function PositionsSection({
  rows,
  departments,
}: {
  rows: PosRow[];
  departments: DeptOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [search, setSearch] = useState("");
  const [deleteRow, setDeleteRow] = useState<PosRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.department?.name ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Base UI Select.Value needs an items map (value=UUID, label=name).
  const departmentItems = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.id, d.name])),
    [departments],
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newDept) return;
    startTransition(async () => {
      try {
        await createPosition(newName, newDept);
        toast.success("เพิ่มตำแหน่งแล้ว");
        setNewName("");
        setNewDept("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "เพิ่มไม่สำเร็จ");
      }
    });
  }

  function startEdit(r: PosRow) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditDept(r.department_id);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDept("");
  }
  function saveEdit() {
    if (!editingId || !editName.trim() || !editDept) return;
    const id = editingId;
    startTransition(async () => {
      try {
        await updatePosition(id, editName, editDept);
        toast.success("บันทึกการแก้ไขแล้ว");
        cancelEdit();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleDelete() {
    if (!deleteRow) return;
    const id = deleteRow.id;
    setDeleteRow(null);
    startTransition(async () => {
      try {
        await deletePosition(id);
        toast.success("ลบตำแหน่งแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 border border-border rounded-lg p-4 bg-card h-fit">
        <h3 className="font-semibold mb-4 text-sm">เพิ่มตำแหน่ง</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newPos" className="text-xs">ชื่อตำแหน่ง *</Label>
            <Input
              id="newPos"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น อาจารย์"
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">สังกัดหน่วยงาน *</Label>
            <Select
              items={departmentItems}
              value={newDept}
              onValueChange={(v) => setNewDept(v ?? "")}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !newName.trim() || !newDept}
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
                <TableHead>ชื่อตำแหน่ง</TableHead>
                <TableHead>สังกัดหน่วยงาน</TableHead>
                <TableHead className="w-[140px] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-muted-foreground text-sm">
                    {search ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีตำแหน่ง — เพิ่มได้ที่ด้านซ้าย"}
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
                        {isEditing ? (
                          <Select
                            items={departmentItems}
                            value={editDept}
                            onValueChange={(v) => setEditDept(v ?? "")}
                            disabled={isPending}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {departments.map((d) => (
                                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {row.department?.name || "-"}
                          </span>
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
        title="ยืนยันการลบตำแหน่ง"
        description={`ต้องการลบ "${deleteRow?.name ?? ""}" ใช่หรือไม่? ระบบจะปฏิเสธหากมีพนักงานใช้ตำแหน่งนี้อยู่`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
