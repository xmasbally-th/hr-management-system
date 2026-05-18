"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addEducation,
  updateEducation,
  deleteEducation,
  type EducationInput,
} from "@/lib/actions/profile-actions";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

interface EducationRow {
  id: string;
  entry_year: number | null;
  graduation_year: number | null;
  institution: string;
  country: string | null;
  degree: string;
  program_name: string | null;
  major_field: string | null;
}

interface Props {
  rows: EducationRow[];
  /** From education_levels catalog. Falls back to a small built-in list if empty. */
  educationLevels: string[];
}

const FALLBACK_LEVELS = [
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
  "ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)",
  "ประกาศนียบัตรวิชาชีพ (ปวช.)",
  "อื่น ๆ",
];

const BLANK: EducationInput = {
  entry_year: null,
  graduation_year: null,
  institution: "",
  country: "",
  degree: "",
  program_name: "",
  major_field: "",
};

export function EducationSection({ rows, educationLevels }: Props) {
  const levelOptions = educationLevels.length > 0 ? educationLevels : FALLBACK_LEVELS;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EducationInput>(BLANK);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function startAdd() {
    setForm(BLANK);
    setAdding(true);
    setEditingId(null);
  }
  function startEdit(r: EducationRow) {
    setForm({
      entry_year: r.entry_year,
      graduation_year: r.graduation_year,
      institution: r.institution,
      country: r.country,
      degree: r.degree,
      program_name: r.program_name ?? "",
      major_field: r.major_field ?? "",
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
          await updateEducation(editingId, form);
          toast.success("บันทึกการแก้ไขแล้ว");
        } else {
          await addEducation(form);
          toast.success("เพิ่มประวัติการศึกษาแล้ว");
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
        await deleteEducation(id);
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">ประวัติการศึกษา</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            รายการวุฒิการศึกษาทั้งหมดที่ได้รับ
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
            <div className="col-span-6 sm:col-span-3 space-y-1">
              <Label className="text-xs">ปีที่เข้าศึกษา</Label>
              <Input
                type="number"
                value={form.entry_year ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    entry_year: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="2560"
                disabled={isPending}
              />
            </div>
            <div className="col-span-6 sm:col-span-3 space-y-1">
              <Label className="text-xs">ปีที่จบการศึกษา</Label>
              <Input
                type="number"
                value={form.graduation_year ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    graduation_year: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="2563"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1">
              <Label className="text-xs">ประเทศ</Label>
              <Input
                value={form.country ?? ""}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="ไทย"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 space-y-1">
              <Label className="text-xs">สถานศึกษา *</Label>
              <Input
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="มหาวิทยาลัย..."
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1">
              <Label className="text-xs">วุฒิการศึกษา *</Label>
              <Select
                value={form.degree}
                onValueChange={(v) => setForm({ ...form, degree: v ?? "" })}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือก..." />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1">
              <Label className="text-xs">หลักสูตร</Label>
              <Input
                value={form.program_name ?? ""}
                onChange={(e) => setForm({ ...form, program_name: e.target.value })}
                placeholder="เช่น ศิลปศาสตรบัณฑิต, บริหารธุรกิจบัณฑิต"
                disabled={isPending}
              />
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1">
              <Label className="text-xs">สาขาวิชา</Label>
              <Input
                value={form.major_field ?? ""}
                onChange={(e) => setForm({ ...form, major_field: e.target.value })}
                placeholder="เช่น การจัดการ, การบัญชี"
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
          <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
          ยังไม่มีประวัติการศึกษา — คลิก &quot;เพิ่มรายการ&quot; เพื่อเพิ่ม
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
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center shrink-0">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {r.degree}
                    {r.program_name && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {r.program_name}
                      </span>
                    )}
                    {r.major_field && (
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · สาขา{r.major_field}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.institution}
                    {r.country && <> · {r.country}</>}
                  </div>
                  {(r.entry_year || r.graduation_year) && (
                    <div className="text-xs text-muted-foreground font-mono mt-1">
                      {r.entry_year ?? "?"} – {r.graduation_year ?? "ปัจจุบัน"}
                    </div>
                  )}
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
        title="ลบประวัติการศึกษา"
        description="ต้องการลบรายการนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
