"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addAdminPosition,
  updateAdminPosition,
  deleteAdminPosition,
  type AdminPositionInput,
} from "@/lib/actions/profile-actions";
import {
  addAdminPositionAsHr,
  updateAdminPositionAsHr,
  deleteAdminPositionAsHr,
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
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";

interface AdminPositionRow {
  id: string;
  appointment_order_number: string | null;
  position_title: string;
  responsible_unit: string | null;
  start_date: string;
  end_date: string | null;
}

interface Props {
  rows: AdminPositionRow[];
  /** When provided, mutations call HR actions targeting this user. */
  targetUserId?: string;
  /** True when the user's correction request flagged "admin_positions". */
  highlightFlagged?: boolean;
}

const BLANK: AdminPositionInput = {
  appointment_order_number: "",
  position_title: "",
  responsible_unit: "",
  start_date: "",
  end_date: "",
};

export function AdminPositionsSection({
  rows,
  targetUserId,
  highlightFlagged,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminPositionInput>(BLANK);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function startAdd() {
    setForm(BLANK);
    setAdding(true);
    setEditingId(null);
  }
  function startEdit(r: AdminPositionRow) {
    setForm({
      appointment_order_number: r.appointment_order_number,
      position_title: r.position_title,
      responsible_unit: r.responsible_unit,
      start_date: r.start_date,
      end_date: r.end_date,
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
            await updateAdminPositionAsHr(targetUserId, editingId, form);
            window.dispatchEvent(new CustomEvent("hr-profile-saved"));
          } else {
            await updateAdminPosition(editingId, form);
          }
          toast.success("บันทึกการแก้ไขแล้ว");
        } else {
          if (targetUserId) {
            await addAdminPositionAsHr(targetUserId, form);
            window.dispatchEvent(new CustomEvent("hr-profile-saved"));
          } else {
            await addAdminPosition(form);
          }
          toast.success("เพิ่มประวัติการบริหารแล้ว");
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
          await deleteAdminPositionAsHr(targetUserId, id);
          window.dispatchEvent(new CustomEvent("hr-profile-saved"));
        } else {
          await deleteAdminPosition(id);
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
          ⭐ ผู้ใช้แจ้งขอแก้ไขข้อมูลในส่วน &quot;ประวัติการดำรงตำแหน่งบริหาร&quot;
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">ประวัติการบริหาร</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ตำแหน่งบริหารที่ดำรงทั้งในอดีตและปัจจุบัน
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
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">เลขที่คำสั่งแต่งตั้ง</Label>
              <Input
                value={form.appointment_order_number ?? ""}
                onChange={(e) => setForm({ ...form, appointment_order_number: e.target.value })}
                placeholder="เช่น 123/2566"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">หน่วยงานที่รับผิดชอบ</Label>
              <Input
                value={form.responsible_unit ?? ""}
                onChange={(e) => setForm({ ...form, responsible_unit: e.target.value })}
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 space-y-1">
              <Label className="text-xs">ตำแหน่ง *</Label>
              <Input
                value={form.position_title}
                onChange={(e) => setForm({ ...form, position_title: e.target.value })}
                placeholder="เช่น ผู้ช่วยคณบดี"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">เริ่มปฏิบัติงาน *</Label>
              <ThaiDatePicker
                value={form.start_date}
                onChange={(v) => setForm({ ...form, start_date: v })}
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">สิ้นสุดการปฏิบัติงาน (ว่าง = ปัจจุบัน)</Label>
              <ThaiDatePicker
                value={form.end_date ?? ""}
                onChange={(v) => setForm({ ...form, end_date: v })}
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
          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
          ยังไม่มีประวัติการบริหาร
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const isEditingThis = editingId === r.id;
            if (isEditingThis) return null;
            const isCurrent = !r.end_date;
            return (
              <li
                key={r.id}
                className="border border-border rounded-lg p-4 flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 grid place-items-center shrink-0">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.position_title}</span>
                    {isCurrent && (
                      <span className="text-[0.625rem] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        ปัจจุบัน
                      </span>
                    )}
                  </div>
                  {r.responsible_unit && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.responsible_unit}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    <span className="font-mono">
                      {r.start_date} – {r.end_date ?? "ปัจจุบัน"}
                    </span>
                    {r.appointment_order_number && (
                      <span className="font-mono">คำสั่ง: {r.appointment_order_number}</span>
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
        title="ลบประวัติการบริหาร"
        description="ต้องการลบรายการนี้ใช่หรือไม่?"
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
