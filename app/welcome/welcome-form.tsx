"use client";

import { useState, useTransition } from "react";
import { confirmProfile } from "@/lib/actions/profile-actions";
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
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  email?: string | null;
  full_name?: string | null;
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
  profile: Profile;
  departments: Array<{ id: string; name: string }>;
}

const EMPLOYEE_TYPES = [
  "ข้าราชการ",
  "พนักงานมหาวิทยาลัย",
  "พนักงานราชการ",
  "พนักงานชั่วคราว",
  "ลูกจ้างประจำ",
  "อื่น ๆ",
];

const TITLE_TH = ["นาย", "นาง", "นางสาว", "ผศ.", "รศ.", "ศ.", "ดร.", "ผศ.ดร.", "รศ.ดร.", "ศ.ดร."];

const EDUCATION_LEVELS = [
  "ปริญญาตรี",
  "ปริญญาโท",
  "ปริญญาเอก",
  "ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)",
  "ประกาศนียบัตรวิชาชีพ (ปวช.)",
  "อื่น ๆ",
];

export function WelcomeForm({ profile, departments }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Required
  const [titleTh, setTitleTh] = useState(profile.title_th ?? "");
  const [firstNameTh, setFirstNameTh] = useState(profile.first_name_th ?? "");
  const [lastNameTh, setLastNameTh] = useState(profile.last_name_th ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [positionTitle, setPositionTitle] = useState(profile.position_title ?? "");
  const [positionNumber, setPositionNumber] = useState(profile.position_number ?? "");
  const [employeeType, setEmployeeType] = useState(profile.employee_type ?? "");
  const [departmentId, setDepartmentId] = useState(profile.department_id ?? "");

  // Optional
  const [titleEn, setTitleEn] = useState(profile.title_en ?? "");
  const [firstNameEn, setFirstNameEn] = useState(profile.first_name_en ?? "");
  const [lastNameEn, setLastNameEn] = useState(profile.last_name_en ?? "");
  const [gender, setGender] = useState(profile.gender ?? "");
  const [birthDate, setBirthDate] = useState(profile.birth_date ?? "");
  const [hireDate, setHireDate] = useState(profile.hire_date ?? "");
  const [educationLevel, setEducationLevel] = useState(profile.education_level ?? "");
  const [currentAddress, setCurrentAddress] = useState(profile.current_address ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await confirmProfile({
          title_th: titleTh,
          first_name_th: firstNameTh,
          last_name_th: lastNameTh,
          phone,
          position_title: positionTitle,
          position_number: positionNumber,
          employee_type: employeeType,
          department_id: departmentId,
          title_en: titleEn || null,
          first_name_en: firstNameEn || null,
          last_name_en: lastNameEn || null,
          gender: gender || null,
          birth_date: birthDate || null,
          hire_date: hireDate || null,
          education_level: educationLevel || null,
          current_address: currentAddress || null,
        });
        toast.success("ยืนยันข้อมูลเรียบร้อย ยินดีต้อนรับเข้าสู่ระบบ");
        // Hard navigation so the new profile_completed_at is picked up by
        // the proxy on the next request.
        window.location.href = "/dashboard";
      } catch (err) {
        const message = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          ยินดีต้อนรับ
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ก่อนเริ่มใช้งาน กรุณาตรวจสอบและกรอกข้อมูลของคุณให้ครบถ้วน — ระบบจะใช้ข้อมูลนี้ในการดำเนินงานต่อไป
        </p>
        <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
          <span>เข้าสู่ระบบในนาม</span>
          <span className="font-mono font-medium text-foreground">{profile.email}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── Section 1: Identity (required) ────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-base">ข้อมูลพื้นฐาน</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              ข้อมูลส่วนตัวที่ระบบจะใช้แสดงผลและประมวลผล
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-3 space-y-1.5">
              <Label>คำนำหน้า (ไทย) *</Label>
              <Select value={titleTh} onValueChange={(v) => setTitleTh(v ?? "")} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
                <SelectContent>
                  {TITLE_TH.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label>ชื่อ (ไทย) *</Label>
              <Input value={firstNameTh} onChange={(e) => setFirstNameTh(e.target.value)} disabled={isPending} required />
            </div>
            <div className="col-span-12 sm:col-span-5 space-y-1.5">
              <Label>นามสกุล (ไทย) *</Label>
              <Input value={lastNameTh} onChange={(e) => setLastNameTh(e.target.value)} disabled={isPending} required />
            </div>

            <div className="col-span-12 sm:col-span-3 space-y-1.5">
              <Label>Title (English)</Label>
              <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Mr. / Dr." disabled={isPending} />
            </div>
            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label>First name (English)</Label>
              <Input value={firstNameEn} onChange={(e) => setFirstNameEn(e.target.value)} disabled={isPending} />
            </div>
            <div className="col-span-12 sm:col-span-5 space-y-1.5">
              <Label>Last name (English)</Label>
              <Input value={lastNameEn} onChange={(e) => setLastNameEn(e.target.value)} disabled={isPending} />
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>เบอร์โทรศัพท์ *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812345678"
                inputMode="tel"
                disabled={isPending}
                required
              />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>เพศ</Label>
              <Select value={gender} onValueChange={(v) => setGender(v ?? "")} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ชาย">ชาย</SelectItem>
                  <SelectItem value="หญิง">หญิง</SelectItem>
                  <SelectItem value="ไม่ระบุ">ไม่ระบุ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>วันเดือนปีเกิด</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} disabled={isPending} />
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>ที่อยู่ปัจจุบัน</Label>
              <Input value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} disabled={isPending} />
            </div>
          </div>
        </section>

        {/* ─── Section 2: Position (required) ──────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-base">ข้อมูลตำแหน่ง</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              ข้อมูลที่หน่วยงานใช้อ้างอิงในเอกสารต่าง ๆ
            </p>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-4 space-y-1.5">
              <Label>เลขที่ตำแหน่ง *</Label>
              <Input value={positionNumber} onChange={(e) => setPositionNumber(e.target.value)} disabled={isPending} required />
            </div>
            <div className="col-span-12 sm:col-span-8 space-y-1.5">
              <Label>ตำแหน่ง *</Label>
              <Input
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                placeholder="เช่น อาจารย์, ผู้ช่วยศาสตราจารย์"
                disabled={isPending}
                required
              />
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>ประเภทบุคลากร *</Label>
              <Select value={employeeType} onValueChange={(v) => setEmployeeType(v ?? "")} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>สังกัดหน่วยงาน *</Label>
              <Select value={departmentId} onValueChange={(v) => setDepartmentId(v ?? "")} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="เลือกหน่วยงาน..." /></SelectTrigger>
                <SelectContent>
                  {departments.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      ยังไม่มีหน่วยงานในระบบ
                    </div>
                  ) : (
                    departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>วุฒิการศึกษา (ปัจจุบัน)</Label>
              <Select value={educationLevel} onValueChange={(v) => setEducationLevel(v ?? "")} disabled={isPending}>
                <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-6 space-y-1.5">
              <Label>วันที่เริ่มทำงาน</Label>
              <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} disabled={isPending} />
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
          💡 ข้อมูลเพิ่มเติม เช่น <b>รูปประจำตัว · ประวัติการศึกษา · เครื่องราชอิสริยาภรณ์ · ประวัติการบริหาร</b>{" "}
          จะสามารถกรอกได้ในหน้าโปรไฟล์ของคุณหลังจากเข้าสู่ระบบ
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                ยืนยันข้อมูลและเริ่มใช้งาน
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
