"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDecorationCatalog,
  updateDecorationCatalog,
  deleteDecorationCatalog,
} from "@/lib/actions/master-data-actions";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pencil, Trash2, Plus, Loader2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";

interface Row {
  id: string;
  name: string;
  abbreviation: string | null;
  sort_order: number;
}

export function DecorationCatalogSection({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newAbbr, setNewAbbr] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAbbr, setEditAbbr] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [search, setSearch] = useState("");
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.abbreviation ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    startTransition(async () => {
      try {
        await createDecorationCatalog({
          name: newName,
          abbreviation: newAbbr || null,
          sort_order: Number(newOrder) || 0,
        });
        toast.success("เพิ่มเครื่องราชอิสริยาภรณ์แล้ว");
        setNewName("");
        setNewAbbr("");
        setNewOrder("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "เพิ่มไม่สำเร็จ");
      }
    });
  }

  function startEdit(r: Row) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditAbbr(r.abbreviation ?? "");
    setEditOrder(String(r.sort_order ?? 0));
  }
  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditAbbr("");
    setEditOrder("");
  }
  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    const id = editingId;
    startTransition(async () => {
      try {
        await updateDecorationCatalog(id, {
          name: editName,
          abbreviation: editAbbr || null,
          sort_order: Number(editOrder) || 0,
        });
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
        await deleteDecorationCatalog(id);
        toast.success("ลบแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 border border-border rounded-lg p-4 bg-card h-fit">
        <h3 className="font-semibold mb-4 text-sm">เพิ่มเครื่องราชอิสริยาภรณ์</h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newDec" className="text-xs">ชื่อเครื่องราชฯ *</Label>
            <Input
              id="newDec"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="เช่น ทวีติยาภรณ์ช้างเผือก"
              disabled={isPending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newDecAbbr" className="text-xs">ชื่อย่อ</Label>
            <Input
              id="newDecAbbr"
              value={newAbbr}
              onChange={(e) => setNewAbbr(e.target.value)}
              placeholder="ท.ช."
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newDecOrder" className="text-xs">ลำดับ</Label>
            <Input
              id="newDecOrder"
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              placeholder="0"
              disabled={isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending || !newName.trim()}>
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
            placeholder={`ค้นหา (${rows.length} รายการ)`}
            className="pl-9"
          />
        </div>

        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ชื่อเครื่องราชฯ</TableHead>
                <TableHead className="w-[100px]">ชื่อย่อ</TableHead>
                <TableHead className="w-[80px] text-center">ลำดับ</TableHead>
                <TableHead className="w-[140px] text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground text-sm">
                    {search ? "ไม่พบข้อมูล" : "ยังไม่มีเครื่องราชอิสริยาภรณ์ใน catalog"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={isPending} />
                        ) : (
                          <span className="font-medium">{row.name}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input value={editAbbr} onChange={(e) => setEditAbbr(e.target.value)} disabled={isPending} />
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{row.abbreviation ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editOrder}
                            onChange={(e) => setEditOrder(e.target.value)}
                            className="h-9 w-20 text-center mx-auto"
                            disabled={isPending}
                          />
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground">{row.sort_order}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={saveEdit} disabled={isPending}>
                              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit} disabled={isPending}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(row)} disabled={isPending}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteRow(row)} disabled={isPending}>
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
        title="ยืนยันการลบเครื่องราชฯ"
        description={`ต้องการลบ "${deleteRow?.name ?? ""}" ใช่หรือไม่? ระบบจะปฏิเสธหากมีพนักงานบันทึกในประวัติ`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
