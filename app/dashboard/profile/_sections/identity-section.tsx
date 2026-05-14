"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateMyProfile,
  type UpdateMyProfileInput,
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
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  title_th?: string | null;
  first_name_th?: string | null;
  last_name_th?: string | null;
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  phone?: string | null;
  position_title?: string | null;
  position_number?: string | null;
  employee_type?: string | null;
  department_id?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  education_level?: string | null;
  current_address?: string | null;
}

interface Props {
  profile: ProfileData;
  departments: Array<{ id: string; name: string }>;
}

const TITLE_TH = ["นาย", "นาง", "นางสาว", "ผศ.", "รศ.", "ศ.", "ดร.", "ผศ.ดร.", "รศ.ดร.", "ศ.ดร."];
const EMPLOYEE_TYPES = [
  "ข้าราชการ",
  "พนักงานมหาวิทยาลัย",
  "พนักงานราชการ",
  "พนักงานชั่วคราว",
  "ลูกจ้างประจำ",
  "อื่น ๆ",
];
const EDUCATION_LEVELS = [
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
  "ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)",
  "ประกาศนียบัตรวิชาชีพ (ปวช.)",
  "อื่น ๆ",
];

export function IdentitySection({ profile, departments }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<UpdateMyProfileInput>({
    title_th: profile.title_th ?? "",
    first_name_th: profile.first_name_th ?? "",
    last_name_th: profile.last_name_th ?? "",
    title_en: profile.title_en ?? "",
    first_name_en: profile.first_name_en ?? "",
    last_name_en: profile.last_name_en ?? "",
    phone: profile.phone ?? "",
    position_title: profile.position_title ?? "",
    position_number: profile.position_number ?? "",
    employee_type: profile.employee_type ?? "",
    department_id: profile.department_id ?? "",
    gender: profile.gender ?? "",
    birth_date: profile.birth_date ?? "",
    hire_date: profile.hire_date ?? "",
    education_level: profile.education_level ?? "",
    current_address: profile.current_address ?? "",
  });

  function set<K extends keyof UpdateMyProfileInput>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMyProfile(form);
        toast.success("บันทึกข้อมูลแล้ว");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <h3 className="font-semibold text-sm">ข้อมูลพื้นฐาน</h3>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label className="text-xs">คำนำหน้า (ไทย)</Label>
            <Select
              value={form.title_th ?? ""}
              onValueChange={(v) => set("title_th", v ?? "")}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>
                {TITLE_TH.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">ชื่อ (ไทย)</Label>
            <Input
              value={form.first_name_th ?? ""}
              onChange={(e) => set("first_name_th", e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-5 space-y-1">
            <Label className="text-xs">นามสกุล (ไทย)</Label>
            <Input
              value={form.last_name_th ?? ""}
              onChange={(e) => set("last_name_th", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="col-span-12 sm:col-span-3 space-y-1">
            <Label className="text-xs">Title (English)</Label>
            <Input
              value={form.title_en ?? ""}
              onChange={(e) => set("title_en", e.target.value)}
              placeholder="Mr. / Dr."
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">First name (English)</Label>
            <Input
              value={form.first_name_en ?? ""}
              onChange={(e) => set("first_name_en", e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-5 space-y-1">
            <Label className="text-xs">Last name (English)</Label>
            <Input
              value={form.last_name_en ?? ""}
              onChange={(e) => set("last_name_en", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">เบอร์โทรศัพท์</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              inputMode="tel"
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">เพศ</Label>
            <Select
              value={form.gender ?? ""}
              onValueChange={(v) => set("gender", v ?? "")}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ชาย">ชาย</SelectItem>
                <SelectItem value="หญิง">หญิง</SelectItem>
                <SelectItem value="ไม่ระบุ">ไม่ระบุ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">วันเดือนปีเกิด</Label>
            <Input
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => set("birth_date", e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="col-span-12 space-y-1">
            <Label className="text-xs">ที่อยู่ปัจจุบัน</Label>
            <Input
              value={form.current_address ?? ""}
              onChange={(e) => set("current_address", e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <h3 className="font-semibold text-sm">ข้อมูลตำแหน่ง</h3>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 sm:col-span-4 space-y-1">
            <Label className="text-xs">เลขที่ตำแหน่ง</Label>
            <Input
              value={form.position_number ?? ""}
              onChange={(e) => set("position_number", e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-8 space-y-1">
            <Label className="text-xs">ตำแหน่ง</Label>
            <Input
              value={form.position_title ?? ""}
              onChange={(e) => set("position_title", e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="col-span-12 sm:col-span-6 space-y-1">
            <Label className="text-xs">ประเภทบุคลากร</Label>
            <Select
              value={form.employee_type ?? ""}
              onValueChange={(v) => set("employee_type", v ?? "")}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>
                {EMPLOYEE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-6 space-y-1">
            <Label className="text-xs">สังกัดหน่วยงาน</Label>
            <Select
              value={form.department_id ?? ""}
              onValueChange={(v) => set("department_id", v ?? "")}
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
          <div className="col-span-12 sm:col-span-6 space-y-1">
            <Label className="text-xs">วุฒิการศึกษา (ปัจจุบัน)</Label>
            <Select
              value={form.education_level ?? ""}
              onValueChange={(v) => set("education_level", v ?? "")}
              disabled={isPending}
            >
              <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-6 space-y-1">
            <Label className="text-xs">วันที่เริ่มทำงาน</Label>
            <Input
              type="date"
              value={form.hire_date ?? ""}
              onChange={(e) => set("hire_date", e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          บันทึก
        </Button>
      </div>
    </form>
  );
}
