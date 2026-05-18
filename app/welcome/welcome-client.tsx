"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Check,
  X,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Send,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  confirmProfileAsAccurate,
  submitFirstReviewCorrection,
  cancelMyCorrectionRequest,
} from "@/lib/actions/welcome-actions";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  status: string;
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
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  current_address?: string | null;
  department?: { id: string; name: string } | null;
}

interface PendingCorrection {
  id: string;
  reason_text: string;
  fields_flagged: string[];
  created_at: string;
}

interface Props {
  profile: Profile;
  educations: Array<{
    id: string;
    entry_year: number | null;
    graduation_year: number | null;
    institution: string;
    country: string | null;
    degree: string;
    program_name: string | null;
    major_field: string | null;
  }>;
  decorations: Array<{
    id: string;
    decoration_name: string;
    abbreviation: string | null;
    approved_date: string | null;
    position_at_grant: string | null;
  }>;
  adminPositions: Array<{
    id: string;
    position_title: string;
    responsible_unit: string | null;
    start_date: string;
    end_date: string | null;
  }>;
  pendingCorrection: PendingCorrection | null;
}

// Field key → Thai label (for the flag-checkboxes in correction form)
const FIELD_LABELS: Record<string, string> = {
  title_th: "คำนำหน้า (ไทย)",
  first_name_th: "ชื่อ (ไทย)",
  last_name_th: "นามสกุล (ไทย)",
  title_en: "คำนำหน้า (อังกฤษ)",
  first_name_en: "ชื่อ (อังกฤษ)",
  last_name_en: "นามสกุล (อังกฤษ)",
  phone: "เบอร์โทรศัพท์",
  gender: "เพศ",
  birth_date: "วันเดือนปีเกิด",
  current_address: "ที่อยู่ปัจจุบัน",
  position_title: "ตำแหน่ง",
  position_number: "เลขที่ตำแหน่ง",
  employee_type: "ประเภทบุคลากร",
  department_id: "สังกัดหน่วยงาน",
  hire_date: "วันที่เริ่มทำงาน",
  educations: "ประวัติการศึกษา",
  decorations: "เครื่องราชอิสริยาภรณ์",
  admin_positions: "ประวัติการดำรงตำแหน่งบริหาร",
};

const FIELD_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: "ข้อมูลส่วนตัว",
    keys: [
      "title_th",
      "first_name_th",
      "last_name_th",
      "title_en",
      "first_name_en",
      "last_name_en",
      "phone",
      "gender",
      "birth_date",
      "current_address",
    ],
  },
  {
    title: "ข้อมูลตำแหน่ง",
    keys: [
      "position_title",
      "position_number",
      "employee_type",
      "department_id",
      "hire_date",
    ],
  },
  {
    title: "ข้อมูลอื่นๆ",
    keys: ["educations", "decorations", "admin_positions"],
  },
];

type Mode = "review" | "correction-form" | "awaiting";

export function WelcomeClient({
  profile,
  educations,
  decorations,
  adminPositions,
  pendingCorrection,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialMode: Mode =
    profile.status === "awaiting_correction" ? "awaiting" : "review";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // correction form state
  const [flaggedFields, setFlaggedFields] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  function toggleField(key: string) {
    setFlaggedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleAccurate() {
    startTransition(async () => {
      try {
        await confirmProfileAsAccurate();
        toast.success("ยืนยันข้อมูลเรียบร้อย — เข้าสู่ระบบ");
        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ยืนยันไม่สำเร็จ");
      }
    });
  }

  function handleSubmitCorrection() {
    if (reason.trim().length < 10) {
      toast.error("กรุณาระบุรายละเอียดที่ต้องการแก้ไข (อย่างน้อย 10 ตัวอักษร)");
      return;
    }
    startTransition(async () => {
      try {
        await submitFirstReviewCorrection({
          fields_flagged: Array.from(flaggedFields),
          reason_text: reason,
        });
        toast.success("ส่งคำขอแก้ไขให้ HR แล้ว — กรุณารอการดำเนินการ");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ส่งคำขอไม่สำเร็จ");
      }
    });
  }

  function handleCancelCorrection() {
    if (!pendingCorrection) return;
    startTransition(async () => {
      try {
        await cancelMyCorrectionRequest(pendingCorrection.id);
        toast.success("ยกเลิกคำขอแล้ว — กลับมายืนยันใหม่");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <span className="text-xl font-bold text-primary-foreground">HR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            ตรวจสอบข้อมูลโปรไฟล์ของคุณ
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
            ฝ่ายบุคคลได้นำเข้าข้อมูลของคุณไว้ในระบบแล้ว
            กรุณาตรวจสอบความถูกต้องก่อนเริ่มใช้งาน
          </p>
        </header>

        {/* Awaiting correction banner */}
        {mode === "awaiting" && pendingCorrection && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-amber-900">
                  รอฝ่ายบุคคลดำเนินการ
                </div>
                <p className="text-sm text-amber-800 mt-1">
                  คุณได้ส่งคำขอแก้ไขข้อมูลแล้วเมื่อ{" "}
                  {formatThaiDateTime(pendingCorrection.created_at)}{" "}
                  — กรุณารอการดำเนินการจากฝ่ายบุคคล
                  หลังจาก HR แก้ไขเรียบร้อยแล้ว คุณจะกลับมายืนยันได้อีกครั้ง
                </p>
                {pendingCorrection.fields_flagged.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-amber-900 mb-1.5">
                      หัวข้อที่แจ้ง:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pendingCorrection.fields_flagged.map((k) => (
                        <span
                          key={k}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 border border-amber-200"
                        >
                          {FIELD_LABELS[k] ?? k}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 rounded-lg bg-white border border-amber-200 p-3">
                  <div className="text-xs font-medium text-amber-900 mb-1">
                    รายละเอียด:
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {pendingCorrection.reason_text}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelCorrection}
                  disabled={isPending}
                  className="mt-3"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <X className="size-3.5 mr-1.5" />
                  )}
                  ยกเลิกคำขอเพื่อยืนยันใหม่
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Read-only profile review */}
        {(mode === "review" || mode === "awaiting") && (
          <div className="space-y-6">
            <ProfileSection
              icon={<User className="size-4" />}
              title="ข้อมูลส่วนตัว"
              rows={[
                ["ชื่อ-นามสกุล (ไทย)", joinThai(profile)],
                ["ชื่อ-นามสกุล (อังกฤษ)", joinEnglish(profile)],
                ["อีเมล", profile.email],
                ["เบอร์โทรศัพท์", profile.phone],
                ["เพศ", profile.gender],
                ["วันเดือนปีเกิด", formatDate(profile.birth_date)],
                ["ที่อยู่ปัจจุบัน", profile.current_address],
              ]}
            />

            <ProfileSection
              icon={<Briefcase className="size-4" />}
              title="ข้อมูลตำแหน่ง"
              rows={[
                ["ตำแหน่ง", profile.position_title],
                ["เลขที่ตำแหน่ง", profile.position_number],
                ["ประเภทบุคลากร", profile.employee_type],
                ["สังกัดหน่วยงาน", profile.department?.name],
                ["วันที่เริ่มทำงาน", formatDate(profile.hire_date)],
              ]}
            />

            <ListSection
              icon={<GraduationCap className="size-4" />}
              title="ประวัติการศึกษา"
              count={educations.length}
            >
              {educations.length === 0 ? (
                <EmptyRow text="ยังไม่มีประวัติการศึกษา" />
              ) : (
                <ul className="divide-y divide-border">
                  {educations.map((e) => (
                    <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="text-sm font-medium">
                        {e.degree}
                        {e.program_name && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · {e.program_name}
                          </span>
                        )}
                        {e.major_field && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            · สาขา{e.major_field}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.institution}
                        {e.country && <> · {e.country}</>}
                        {(e.entry_year || e.graduation_year) && (
                          <> · {e.entry_year ?? "?"} – {e.graduation_year ?? "ปัจจุบัน"}</>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ListSection>

            <ListSection
              icon={<Award className="size-4" />}
              title="เครื่องราชอิสริยาภรณ์"
              count={decorations.length}
            >
              {decorations.length === 0 ? (
                <EmptyRow text="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="divide-y divide-border">
                  {decorations.map((d) => (
                    <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="text-sm font-medium">
                        {d.decoration_name}
                        {d.abbreviation && (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            ({d.abbreviation})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.position_at_grant && <>{d.position_at_grant} · </>}
                        {formatDate(d.approved_date)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ListSection>

            <ListSection
              icon={<Briefcase className="size-4" />}
              title="ประวัติการดำรงตำแหน่งบริหาร"
              count={adminPositions.length}
            >
              {adminPositions.length === 0 ? (
                <EmptyRow text="ยังไม่มีข้อมูล" />
              ) : (
                <ul className="divide-y divide-border">
                  {adminPositions.map((p) => (
                    <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="text-sm font-medium">{p.position_title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.responsible_unit && <>{p.responsible_unit} · </>}
                        {formatDate(p.start_date)} – {formatDate(p.end_date) ?? "ปัจจุบัน"}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ListSection>
          </div>
        )}

        {/* Action bar — review mode */}
        {mode === "review" && (
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => setMode("correction-form")}
              disabled={isPending}
              className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
            >
              <X className="size-4 mr-2" />
              ข้อมูลไม่ถูกต้อง — แจ้งแก้ไข
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
            >
              <Check className="size-4 mr-2" />
              ยืนยันข้อมูลถูกต้องทั้งหมด
            </Button>
          </div>
        )}

        {/* Correction form mode */}
        {mode === "correction-form" && (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">แจ้งข้อมูลที่ต้องแก้ไขให้ฝ่ายบุคคล</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    กรุณาเลือกหัวข้อที่ต้องแก้ไข
                    และระบุรายละเอียดเพื่อให้ฝ่ายบุคคลดำเนินการได้ถูกต้อง
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    หัวข้อที่ต้องแก้ไข
                  </Label>
                  <div className="space-y-3">
                    {FIELD_GROUPS.map((g) => (
                      <div key={g.title}>
                        <div className="text-xs font-medium text-muted-foreground mb-1.5">
                          {g.title}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {g.keys.map((k) => (
                            <label
                              key={k}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition",
                                flaggedFields.has(k)
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:bg-muted/50",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={flaggedFields.has(k)}
                                onChange={() => toggleField(k)}
                                disabled={isPending}
                                className="size-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
                              />
                              <span className="text-sm">{FIELD_LABELS[k]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="reason"
                    className="text-sm font-semibold mb-2 block"
                  >
                    รายละเอียด <span className="text-destructive">*</span>
                  </Label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="โปรดระบุรายละเอียดข้อมูลที่ต้องการแก้ไข เช่น 'นามสกุลสะกดผิด ที่ถูกต้องคือ ...' หรือ 'เบอร์โทรเปลี่ยนเป็น 089-xxx-xxxx'"
                    rows={6}
                    disabled={isPending}
                    maxLength={2000}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    {reason.length} / 2000
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("review")}
                disabled={isPending}
              >
                <ArrowLeft className="size-4 mr-2" />
                ย้อนกลับ
              </Button>
              <Button
                type="button"
                onClick={handleSubmitCorrection}
                disabled={isPending || reason.trim().length < 10}
              >
                {isPending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Send className="size-4 mr-2" />
                )}
                ส่งคำขอให้ฝ่ายบุคคล
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="ยืนยันความถูกต้องของข้อมูล"
          description="คุณได้ตรวจสอบข้อมูลทั้งหมดเรียบร้อยและยืนยันว่าถูกต้อง — ระบบจะเปิดให้คุณเริ่มใช้งานได้ทันที"
          confirmLabel="ยืนยัน"
          onConfirm={handleAccurate}
        />
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function joinThai(p: Profile): string | null {
  const parts = [p.title_th, p.first_name_th, p.last_name_th].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function joinEnglish(p: Profile): string | null {
  const parts = [p.title_en, p.first_name_en, p.last_name_en].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Deterministic Thai date formatter — produces identical output on both
 * server and client to avoid React hydration mismatches. Returns the form
 * "DD เดือน พ.ศ." (e.g. "15 มกราคม 2569").
 */
const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const yearBE = d.getUTCFullYear() + 543;
  return `${day} ${month} ${yearBE}`;
}

/**
 * Deterministic Thai datetime formatter (UTC-based to match server/client).
 * Returns "DD เดือน พ.ศ. HH:mm" (e.g. "15 มกราคม 2569 14:30").
 */
function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS[d.getUTCMonth()];
  const yearBE = d.getUTCFullYear() + 543;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} ${hh}:${mm} น.`;
}

interface ProfileSectionProps {
  icon: React.ReactNode;
  title: string;
  rows: Array<[string, string | null | undefined]>;
}

function ProfileSection({ icon, title, rows }: ProfileSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div className="size-8 grid place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="font-semibold">{title}</h2>
      </header>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm mt-0.5", !value && "text-muted-foreground italic")}>
              {value || "— ไม่ระบุ —"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface ListSectionProps {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}

function ListSection({ icon, title, count, children }: ListSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        <div className="size-8 grid place-items-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="font-semibold flex-1">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {count} รายการ
        </span>
      </header>
      {children}
    </section>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="text-center py-6 text-sm text-muted-foreground italic">
      {text}
    </div>
  );
}
