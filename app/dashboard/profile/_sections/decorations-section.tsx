"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDecoration,
  updateDecoration,
  deleteDecoration,
  type DecorationInput,
} from "@/lib/actions/profile-actions";
import {
  addDecorationAsHr,
  updateDecorationAsHr,
  deleteDecorationAsHr,
} from "@/lib/actions/hr-profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  Award,
} from "lucide-react";
import { toast } from "sonner";

interface DecorationRow {
  id: string;
  decoration_name: string;
  abbreviation: string | null;
  document_reference: string | null;
  approved_date: string | null;
  position_at_grant: string | null;
}

interface CatalogEntry {
  name: string;
  abbreviation: string | null;
}

interface Props {
  rows: DecorationRow[];
  /** From master-data catalog — used as datalist autocomplete. */
  catalog?: CatalogEntry[];
  /** When provided, mutations call HR actions targeting this user. */
  targetUserId?: string;
  /** True when the user's correction request flagged "decorations". */
  highlightFlagged?: boolean;
}

const BLANK: DecorationInput = {
  decoration_name: "",
  abbreviation: "",
  document_reference: "",
  approved_date: "",
  position_at_grant: "",
};

export function DecorationsSection({
  rows,
  catalog = [],
  targetUserId,
  highlightFlagged,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DecorationInput>(BLANK);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function startAdd() {
    setForm(BLANK);
    setAdding(true);
    setEditingId(null);
  }
  function startEdit(r: DecorationRow) {
    setForm({
      decoration_name: r.decoration_name,
      abbreviation: r.abbreviation,
      document_reference: r.document_reference,
      approved_date: r.approved_date,
      position_at_grant: r.position_at_grant,
    });
    setEditingId(r.id);
    setAdding(false);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
    setForm(BLANK);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        if (editingId) {
          if (targetUserId) {
            await updateDecorationAsHr(targetUserId, editingId, form);
            window.dispatchEvent(new CustomEvent("hr-profile-saved"));
          } else {
            await updateDecoration(editingId, form);
          }
          toast.success("บันทึกการแก้ไขแล้ว");
        } else {
          if (targetUserId) {
            await addDecorationAsHr(targetUserId, form);
            window.dispatchEvent(new CustomEvent("hr-profile-saved"));
          } else {
            await addDecoration(form);
          }
          toast.success("เพิ่มเครื่องราชอิสริยาภรณ์แล้ว");
        }
        cancel();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    startTransition(async () => {
      try {
        if (targetUserId) {
          await deleteDecorationAsHr(targetUserId, id);
          window.dispatchEvent(new CustomEvent("hr-profile-saved"));
        } else {
          await deleteDecoration(id);
        }
        toast.success("ลบรายการแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      }
    });
  }

  const editing = adding || !!editingId;

  return (
    <div className="space-y-4">
      {highlightFlagged && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          ⭐ ผู้ใช้แจ้งขอแก้ไขข้อมูลในส่วน &quot;เครื่องราชอิสริยาภรณ์&quot;
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">เครื่องราชอิสริยาภรณ์ / เหรียญจักรพรรดิมาลา</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ประวัติการได้รับเครื่องราชอิสริยาภรณ์
          </p>
        </div>
        {!editing && (
          <Button size="sm" onClick={startAdd} disabled={isPending}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            เพิ่มรายการ
          </Button>
        )}
      </div>

      {editing && (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4 space-y-3">
          <div className="text-sm font-medium">
            {editingId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-8 space-y-1">
              <Label className="text-xs">เครื่องราชอิสริยาภรณ์ *</Label>
              <Input
                value={form.decoration_name}
                onChange={(e) => {
                  const name = e.target.value;
                  // Auto-fill abbreviation when name matches a catalog entry
                  const match = catalog.find(
                    (c) => c.name.toLowerCase() === name.toLowerCase(),
                  );
                  setForm({
                    ...form,
                    decoration_name: name,
                    ...(match && match.abbreviation
                      ? { abbreviation: match.abbreviation }
                      : {}),
                  });
                }}
                list="decoration-catalog-list"
                placeholder="พิมพ์/เลือกจากรายการ..."
                disabled={isPending}
              />
              {catalog.length > 0 && (
                <datalist id="decoration-catalog-list">
                  {catalog.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.abbreviation ? `(${c.abbreviation})` : ""}
                    </option>
                  ))}
                </datalist>
              )}
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1">
              <Label className="text-xs">ชื่อย่อ</Label>
              <Input
                value={form.abbreviation ?? ""}
                onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
                placeholder="ท.ช."
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">เอกสารอ้างอิง</Label>
              <Input
                value={form.document_reference ?? ""}
                onChange={(e) => setForm({ ...form, document_reference: e.target.value })}
                placeholder="เลขที่ราชกิจจาฯ"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">อนุมัติเมื่อ</Label>
              <ThaiDatePicker
                value={form.approved_date ?? ""}
                onChange={(v) => setForm({ ...form, approved_date: v })}
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 space-y-1">
              <Label className="text-xs">ตำแหน่งราชการ ณ ขณะรับ</Label>
              <Input
                value={form.position_at_grant ?? ""}
                onChange={(e) => setForm({ ...form, position_at_grant: e.target.value })}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={cancel} disabled={isPending}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              ยกเลิก
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              )}
              บันทึก
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 && !editing ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
          ยังไม่มีประวัติเครื่องราชอิสริยาภรณ์
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isEditingThis = editingId === r.id;
            if (isEditingThis) return null;
            return (
              <li
                key={r.id}
                className="border border-border rounded-lg p-4 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 grid place-items-center shrink-0">
                  <Award className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {r.decoration_name}
                    {r.abbreviation && (
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        ({r.abbreviation})
                      </span>
                    )}
                  </div>
                  {r.position_at_grant && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ขณะดำรงตำแหน่ง: {r.position_at_grant}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    {r.approved_date && (
                      <span>อนุมัติ: {r.approved_date}</span>
                    )}
                    {r.document_reference && (
                      <span className="font-mono">{r.document_reference}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => startEdit(r)}
                    disabled={isPending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(r.id)}
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="ลบเครื่องราชอิสริยาภรณ์"
        description="ต้องการลบรายการนี้ใช่หรือไม่?"
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
