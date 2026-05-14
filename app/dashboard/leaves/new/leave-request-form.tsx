"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLeaveRequest,
  type CreateLeaveRequestInput,
} from "@/lib/actions/leave-actions";
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
import { FileUpload } from "@/components/file-upload";
import {
  Loader2,
  CalendarDays,
  Hospital,
  Briefcase,
  Baby,
  Send,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LeaveType } from "@/types/supabase";

type Kind = "vacation" | "sick" | "personal" | "maternity";

interface Balance {
  typeName: string;
  totalDays: number;
  usedDays: number;
}

interface Props {
  leaveTypes: LeaveType[];
  employees: { id: string; full_name: string; email: string }[];
  balances?: Balance[];
}

const KIND_META: Record<
  Kind,
  {
    label: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: "sky" | "emerald" | "amber" | "rose";
    match: RegExp;
  }
> = {
  vacation: {
    label: "ลาพักผ่อน",
    sub: "Vacation",
    icon: CalendarDays,
    tone: "sky",
    match: /พักผ่อน|vacation/i,
  },
  sick: {
    label: "ลาป่วย",
    sub: "Sick",
    icon: Hospital,
    tone: "emerald",
    match: /ป่วย|sick/i,
  },
  personal: {
    label: "ลากิจ",
    sub: "Personal",
    icon: Briefcase,
    tone: "amber",
    match: /กิจ|personal/i,
  },
  maternity: {
    label: "ลาคลอด",
    sub: "Maternity",
    icon: Baby,
    tone: "rose",
    match: /คลอด|maternity/i,
  },
};

const TONE_BG: Record<string, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};
const TONE_HOVER_BG: Record<string, string> = {
  sky: "hover:bg-sky-600",
  emerald: "hover:bg-emerald-600",
  amber: "hover:bg-amber-600",
  rose: "hover:bg-rose-600",
};
const TONE_TEXT: Record<string, string> = {
  sky: "text-sky-700",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  rose: "text-rose-700",
};
const TONE_BORDER: Record<string, string> = {
  sky: "border-sky-300 ring-sky-200",
  emerald: "border-emerald-300 ring-emerald-200",
  amber: "border-amber-300 ring-amber-200",
  rose: "border-rose-300 ring-rose-200",
};
const TONE_TILE: Record<string, string> = {
  sky: "bg-sky-50 text-sky-900 border-sky-200",
  emerald: "bg-emerald-50 text-emerald-900 border-emerald-200",
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  rose: "bg-rose-50 text-rose-900 border-rose-200",
};
const TONE_NOTICE: Record<string, string> = {
  sky: "bg-sky-50 border-sky-200 text-sky-900",
  emerald: "bg-emerald-50 border-emerald-200 text-emerald-900",
  amber: "bg-amber-50 border-amber-200 text-amber-900",
  rose: "bg-rose-50 border-rose-200 text-rose-900",
};

const STORAGE_KEY = "hr-leave-form-kind";

/**
 * 4-in-1 leave request form (Vacation/Sick/Personal/Maternity).
 *
 * - Top: balance strip with 4 tiles (click to switch type)
 * - Below: type-specific fields, color-aware
 * - Maternity auto-fills date range from EDD (start = EDD - 30, end = +89)
 * - Sick requires medical cert when total_days > 3 (handled via FileUpload)
 */
export function LeaveRequestForm({ leaveTypes, employees, balances = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Active leave kind — persisted in localStorage
  const [kind, setKind] = useState<Kind>("vacation");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "vacation" || stored === "sick" || stored === "personal" || stored === "maternity") {
        setKind(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);
  function changeKind(k: Kind) {
    setKind(k);
    try {
      localStorage.setItem(STORAGE_KEY, k);
    } catch {
      /* ignore */
    }
  }

  // Resolve the matching leave_type_id from DB based on the active kind
  const matchedType = useMemo(
    () => leaveTypes.find((lt) => KIND_META[kind].match.test(lt.name)),
    [leaveTypes, kind],
  );

  // Common fields
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [reason, setReason] = useState("");

  // Sick-specific
  const [symptoms, setSymptoms] = useState("");
  const [hospital, setHospital] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [medicalCertPath, setMedicalCertPath] = useState<string | null>(null);

  // Personal-specific
  const [personalPlan, setPersonalPlan] = useState<"planned" | "urgent">("planned");

  // Maternity-specific
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [pregnancyWeeks, setPregnancyWeeks] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Vacation-specific
  const [accumulatedDays, setAccumulatedDays] = useState("");
  const [annualDays, setAnnualDays] = useState("");
  const [substitute1Id, setSubstitute1Id] = useState("");
  const [substitute2Id, setSubstitute2Id] = useState("");
  const [substitute3Id, setSubstitute3Id] = useState("");
  const [branchHeadOpinion, setBranchHeadOpinion] = useState("");

  // Maternity: auto-fill date range from EDD (start = EDD - 30, end = +89 → 90 days total)
  useEffect(() => {
    if (kind !== "maternity" || !expectedDeliveryDate) return;
    const edd = new Date(expectedDeliveryDate);
    const start = new Date(edd);
    start.setDate(start.getDate() - 30);
    const end = new Date(start);
    end.setDate(end.getDate() + 89);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  }, [kind, expectedDeliveryDate]);

  function calcDays(): number {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }
  const totalDays = calcDays();

  // Resolve balance for the active kind
  const activeBalance = useMemo(() => {
    return balances.find((b) => KIND_META[kind].match.test(b.typeName));
  }, [balances, kind]);

  // Sick cert required when > 3 days
  const requiresMedicalCert = (kind === "sick" && totalDays > 3) || kind === "maternity";
  const meta = KIND_META[kind];

  function validate(): string | null {
    if (!matchedType)
      return `ระบบยังไม่ได้ตั้งค่าประเภท "${meta.label}" — กรุณาแจ้ง HR`;
    if (!startDate || !endDate) return "กรุณาเลือกช่วงวันที่";
    if (totalDays <= 0) return "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่ม";

    if (kind === "sick") {
      if (!symptoms.trim()) return "กรุณาระบุอาการเจ็บป่วย";
      if (totalDays > 3 && !medicalCertPath)
        return "ลาป่วยเกิน 3 วัน ต้องแนบใบรับรองแพทย์";
    }
    if (kind === "personal") {
      if (!reason.trim() || reason.trim().length < 10)
        return "กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร";
      if (personalPlan === "planned") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        const daysUntil = Math.floor((start.getTime() - today.getTime()) / 86400000);
        if (daysUntil < 3)
          return "ลากิจแบบวางแผน ต้องยื่นล่วงหน้าอย่างน้อย 3 วัน";
      }
    }
    if (kind === "maternity") {
      if (!expectedDeliveryDate) return "กรุณาระบุวันกำหนดคลอด";
      if (!emergencyContact.trim()) return "กรุณาระบุเบอร์ติดต่อฉุกเฉิน";
      if (totalDays !== 90) return "ลาคลอดต้องเป็น 90 วัน";
      if (!medicalCertPath) return "กรุณาแนบใบรับรองแพทย์";
    }
    if (kind === "vacation") {
      if (!substitute1Id) return "กรุณาเลือกผู้ปฏิบัติหน้าที่แทนคนที่ 1";
    }
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    const fullReason =
      kind === "sick"
        ? `[อาการ] ${symptoms}${hospital ? `\n[รพ.] ${hospital}` : ""}${doctorName ? `\n[แพทย์] ${doctorName}` : ""}`
        : kind === "personal"
          ? `[${personalPlan === "urgent" ? "ด่วน" : "วางแผน"}] ${reason}`
          : kind === "maternity"
            ? `[อายุครรภ์] ${pregnancyWeeks || "-"} สัปดาห์${hospital ? ` · [รพ.] ${hospital}` : ""}${doctorName ? ` · [แพทย์] ${doctorName}` : ""}`
            : reason || null;

    const input: CreateLeaveRequestInput = {
      leave_type_id: matchedType!.id,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      reason: fullReason || null,
      contact_number:
        kind === "maternity" ? emergencyContact : contactNumber || null,
      submission_channel: "digital",
    };

    if (kind === "maternity") {
      input.expected_delivery_date = expectedDeliveryDate;
    }
    if (medicalCertPath) {
      input.medical_cert_url = medicalCertPath;
    }
    if (kind === "vacation") {
      input.vacation_details = {
        accumulated_days: Number(accumulatedDays) || 0,
        annual_days: Number(annualDays) || 0,
        substitute_1_id: substitute1Id || null,
        substitute_2_id: substitute2Id || null,
        substitute_3_id: substitute3Id || null,
        branch_head_opinion: branchHeadOpinion || null,
      };
    }

    startTransition(async () => {
      try {
        await createLeaveRequest(input);
        toast.success("ยื่นคำขอลาเรียบร้อยแล้ว");
        router.push("/dashboard/leaves");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ยื่นคำขอลา</h1>
        <p className="text-muted-foreground text-sm">
          เลือกประเภทการลาด้านล่าง แล้วกรอกข้อมูลให้ครบถ้วน
        </p>
      </div>

      {/* Balance strip — 4 tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(KIND_META) as Kind[]).map((k) => {
          const m = KIND_META[k];
          const bal = balances.find((b) => m.match.test(b.typeName));
          const remaining = bal ? bal.totalDays - bal.usedDays : null;
          const isActive = kind === k;
          const Icon = m.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => changeKind(k)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition relative",
                isActive
                  ? cn(TONE_TILE[m.tone], "shadow-md ring-2", TONE_BORDER[m.tone])
                  : "bg-card border-border hover:border-muted-foreground/40",
              )}
            >
              <div className="flex items-center justify-between">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? TONE_TEXT[m.tone] : "text-muted-foreground",
                  )}
                />
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    isActive ? TONE_BG[m.tone] : "bg-border",
                  )}
                />
              </div>
              <div className="mt-2 text-sm font-semibold">{m.label}</div>
              <div className="text-xs text-muted-foreground">{m.sub}</div>
              {bal ? (
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono">
                    {remaining}
                    <span className="text-xs font-medium text-muted-foreground ml-1">
                      /{bal.totalDays} วัน
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-muted-foreground">
                  ยังไม่มีสิทธิ์ในระบบ
                </div>
              )}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tab pills */}
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const m = KIND_META[k];
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => changeKind(k)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Notice box — color-aware per type */}
        <div
          className={cn(
            "rounded-lg border p-3 text-xs flex items-start gap-2",
            TONE_NOTICE[meta.tone],
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            {kind === "vacation" &&
              "ลาพักผ่อน — เลือกผู้ปฏิบัติแทนคนที่ 1 บังคับ (สูงสุด 3 คน) และระบุความเห็นหัวหน้าสาขา (ถ้ามี)"}
            {kind === "sick" &&
              "ลาป่วย — ลาเกิน 3 วัน ต้องแนบใบรับรองแพทย์ · อนุญาตให้ลงวันที่ย้อนหลัง"}
            {kind === "personal" &&
              "ลากิจ — แบบวางแผน ต้องยื่นล่วงหน้าอย่างน้อย 3 วัน · เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร"}
            {kind === "maternity" &&
              "ลาคลอด — ระบบจะคำนวณช่วงวันลา 90 วันจากวันกำหนดคลอดอัตโนมัติ · ต้องแนบใบรับรองแพทย์"}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive p-3 text-sm flex items-center gap-2">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Form card */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
          {/* Maternity: pregnancy info box at top (special pink card) */}
          {kind === "maternity" && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-4">
              <div className="text-sm font-semibold text-rose-900">
                ข้อมูลการตั้งครรภ์
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">วันกำหนดคลอด (EDD) *</Label>
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">อายุครรภ์ (สัปดาห์)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={42}
                    value={pregnancyWeeks}
                    onChange={(e) => setPregnancyWeeks(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">เบอร์ฉุกเฉิน *</Label>
                  <Input
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="คู่สมรส / ครอบครัว"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Personal: planning vs urgent segmented */}
          {kind === "personal" && (
            <div className="space-y-2">
              <Label>ลักษณะการลา</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["planned", "urgent"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPersonalPlan(p)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition",
                      personalPlan === p
                        ? "border-amber-400 bg-amber-50"
                        : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="text-sm font-semibold">
                      {p === "planned" ? "วางแผนล่วงหน้า" : "เร่งด่วน"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p === "planned"
                        ? "ยื่นก่อน ≥ 3 วัน"
                        : "ลาด่วนเหตุจำเป็น"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>วันที่เริ่ม *</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isPending || kind === "maternity"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>วันที่สิ้นสุด *</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isPending || kind === "maternity"}
                required
              />
            </div>
          </div>

          {/* Days summary + progress */}
          {totalDays > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between gap-4 text-sm">
              <span>
                จำนวนวันลา:{" "}
                <span className="font-bold text-base">{totalDays} วัน</span>
              </span>
              {activeBalance && (
                <div className="flex items-center gap-2 min-w-0 flex-1 max-w-xs">
                  <div className="h-1.5 flex-1 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", TONE_BG[meta.tone])}
                      style={{
                        width: `${Math.min(((activeBalance.usedDays + totalDays) / activeBalance.totalDays) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    เหลือ {activeBalance.totalDays - activeBalance.usedDays - totalDays} วัน
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Contact (not for maternity — uses emergency contact instead) */}
          {kind !== "maternity" && (
            <div className="space-y-1.5">
              <Label>เบอร์ติดต่อระหว่างลา</Label>
              <Input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="0812345678"
                disabled={isPending}
              />
            </div>
          )}

          {/* Sick-specific */}
          {kind === "sick" && (
            <>
              <div className="space-y-1.5">
                <Label>อาการเจ็บป่วย *</Label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="เช่น มีไข้สูง ปวดศีรษะรุนแรง"
                  disabled={isPending}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>โรงพยาบาล (ถ้ามี)</Label>
                  <Input
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ชื่อแพทย์ (ถ้ามี)</Label>
                  <Input
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
            </>
          )}

          {/* Maternity: hospital + doctor */}
          {kind === "maternity" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>โรงพยาบาลที่คลอด</Label>
                <Input
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ชื่อแพทย์ผู้ดูแล</Label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          )}

          {/* Personal: reason with counter */}
          {kind === "personal" && (
            <div className="space-y-1.5">
              <Label>เหตุผลการลา * (≥ 10 ตัวอักษร)</Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={isPending}
              />
              <div className="text-xs text-muted-foreground text-right">
                {reason.length} ตัวอักษร
              </div>
            </div>
          )}

          {/* Medical cert upload (sick > 3 days, or maternity) */}
          {requiresMedicalCert && (
            <div className="space-y-1.5">
              <Label>
                ใบรับรองแพทย์{" "}
                <span className="text-rose-600 font-semibold">
                  {kind === "maternity" || (kind === "sick" && totalDays > 3)
                    ? "(บังคับ)"
                    : "(ถ้ามี)"}
                </span>
              </Label>
              <FileUpload
                pathPrefix={`leave-cert/${kind}`}
                onUploaded={setMedicalCertPath}
                label="คลิกหรือลากไฟล์มาวาง (PDF, JPG, PNG, max 5 MB)"
              />
            </div>
          )}

          {/* Vacation-specific */}
          {kind === "vacation" && (
            <div className="space-y-5 border-t border-border pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>วันสะสมจากปีก่อน</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={accumulatedDays}
                    onChange={(e) => setAccumulatedDays(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>วันลาประจำปี</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={annualDays}
                    onChange={(e) => setAnnualDays(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              {[
                { label: "ผู้ปฏิบัติหน้าที่แทนคนที่ 1 *", v: substitute1Id, set: setSubstitute1Id, required: true },
                { label: "ผู้ปฏิบัติหน้าที่แทนคนที่ 2", v: substitute2Id, set: setSubstitute2Id, required: false },
                { label: "ผู้ปฏิบัติหน้าที่แทนคนที่ 3", v: substitute3Id, set: setSubstitute3Id, required: false },
              ].map((s, idx) => (
                <div key={idx} className="space-y-1.5">
                  <Label>{s.label}</Label>
                  <Select
                    value={s.v}
                    onValueChange={(val) => s.set(val ?? "")}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          s.required
                            ? "เลือกผู้ปฏิบัติแทน..."
                            : "เลือกผู้ปฏิบัติแทน (ถ้ามี)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {employees
                        .filter(
                          (e) =>
                            !(
                              (idx > 0 && e.id === substitute1Id) ||
                              (idx > 1 && e.id === substitute2Id) ||
                              (idx === 0 &&
                                (e.id === substitute2Id ||
                                  e.id === substitute3Id)) ||
                              (idx === 1 && e.id === substitute3Id)
                            ),
                        )
                        .map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="space-y-1.5">
                <Label>ความเห็นหัวหน้าสาขา (ถ้ามี)</Label>
                <Input
                  value={branchHeadOpinion}
                  onChange={(e) => setBranchHeadOpinion(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/leaves")}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className={cn("text-white", TONE_BG[meta.tone], TONE_HOVER_BG[meta.tone])}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            ส่งคำขอลา
          </Button>
        </div>
      </form>
    </div>
  );
}
