"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Check,
  X,
  Loader2,
  Clock,
  ArrowRight,
  ClipboardCheck,
  AlertTriangle,
  Rocket,
  HandIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileOverview } from "@/components/profile-overview";
import { cn } from "@/lib/utils";
import {
  CorrectionRequestForm,
  FIELD_LABELS,
} from "@/components/correction-request-form";
import {
  confirmProfileAsAccurate,
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

type Mode = "intro" | "review" | "correction-form" | "awaiting";

/**
 * Decide which mode to start on:
 *   - awaiting_correction → "awaiting" (legacy path — user has pending request)
 *   - otherwise           → "intro" (first-time wizard)
 */
function getInitialMode(status: string): Mode {
  if (status === "awaiting_correction") return "awaiting";
  return "intro";
}

export function WelcomeClient({
  profile,
  educations,
  decorations,
  adminPositions,
  pendingCorrection,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(getInitialMode(profile.status));
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Step indicator — only show during onboarding wizard (intro/review/form)
  const stepIndex =
    mode === "intro" ? 0 : mode === "review" ? 1 : mode === "correction-form" ? 2 : -1;
  const wizardSteps = [
    { label: "ทักทาย", icon: HandIcon },
    { label: "ตรวจสอบ", icon: ClipboardCheck },
    { label: "ดำเนินการ", icon: Rocket },
  ];

  // First-name fallback used by the intro greeting
  const firstName =
    profile.first_name_th?.trim() ||
    profile.full_name?.split(" ")[0] ||
    profile.email?.split("@")[0] ||
    "คุณ";

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
        <header className="mb-6 text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <span className="text-xl font-bold text-primary-foreground">HR</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {mode === "intro"
              ? "ยินดีต้อนรับสู่ระบบ HR"
              : mode === "correction-form"
                ? "แจ้งข้อมูลที่ต้องแก้ไข"
                : "ตรวจสอบข้อมูลโปรไฟล์ของคุณ"}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto">
            {mode === "intro"
              ? "เริ่มต้นใช้งานง่าย ๆ ผ่านขั้นตอนสั้น ๆ"
              : mode === "correction-form"
                ? "ระบุข้อมูลที่ต้องการให้ฝ่ายบุคคลแก้ไข"
                : "ฝ่ายบุคคลได้นำเข้าข้อมูลของคุณไว้ในระบบแล้ว — กรุณาตรวจสอบความถูกต้องก่อนเริ่มใช้งาน"}
          </p>
        </header>

        {/* Step indicator — shown during the wizard, hidden during awaiting */}
        {stepIndex >= 0 && (
          <ol className="flex items-center justify-center gap-1 sm:gap-3 mb-8">
            {wizardSteps.map((step, i) => {
              const Icon = step.icon;
              const reached = i <= stepIndex;
              const active = i === stepIndex;
              return (
                <li key={step.label} className="flex items-center gap-1 sm:gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium border transition",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : reached
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    <span
                      className={cn(
                        "size-5 rounded-full grid place-items-center text-[0.625rem] font-bold",
                        active
                          ? "bg-primary-foreground/20"
                          : reached
                            ? "bg-emerald-200/80"
                            : "bg-background",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Icon className="size-3.5" />
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {i < wizardSteps.length - 1 && (
                    <div
                      className={cn(
                        "w-4 sm:w-8 h-px",
                        i < stepIndex ? "bg-emerald-300" : "bg-border",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Intro step */}
        {mode === "intro" && (
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-primary/20 bg-card p-6 sm:p-8 text-center space-y-4">
              <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">
                  สวัสดีคุณ {firstName}!
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
                  ก่อนเริ่มใช้งาน ขอเวลาสั้น ๆ ในการตรวจสอบข้อมูลที่ฝ่ายบุคคล
                  กรอกไว้ให้คุณ — เพื่อให้แน่ใจว่าข้อมูลทั้งหมดถูกต้อง
                </p>
              </div>

              <ul className="text-left max-w-md mx-auto space-y-3 text-sm pt-2">
                <li className="flex items-start gap-3">
                  <span className="size-6 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">
                    1
                  </span>
                  <div>
                    <div className="font-medium">ตรวจสอบข้อมูล</div>
                    <div className="text-xs text-muted-foreground">
                      ดู ชื่อ-นามสกุล · ตำแหน่ง · ประวัติการศึกษา ที่ระบบมี
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="size-6 rounded-full bg-amber-100 text-amber-700 grid place-items-center text-xs font-bold shrink-0 mt-0.5">
                    2
                  </span>
                  <div>
                    <div className="font-medium">แจ้งสิ่งที่ต้องแก้ (ถ้ามี)</div>
                    <div className="text-xs text-muted-foreground">
                      ส่งคำขอให้ฝ่ายบุคคลแก้ไขข้อมูลที่ไม่ถูกต้อง
                    </div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="size-6 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0 mt-0.5">
                    3
                  </span>
                  <div>
                    <div className="font-medium">เริ่มใช้งานระบบ</div>
                    <div className="text-xs text-muted-foreground">
                      ยื่นใบลา · ขออนุญาตเดินทาง · ดูประวัติของคุณ
                    </div>
                  </div>
                </li>
              </ul>

              <div className="pt-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setMode("review")}
                  disabled={isPending}
                >
                  เริ่มตรวจสอบข้อมูล
                  <ArrowRight className="size-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Awaiting correction banner — legacy path; rarely shown after the
            UX change that immediately marks users approved on submit. */}
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
                  {formatThaiDateTime(pendingCorrection.created_at)}
                </p>
                {pendingCorrection.fields_flagged.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pendingCorrection.fields_flagged.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900 border border-amber-200"
                      >
                        {FIELD_LABELS[k] ?? k}
                      </span>
                    ))}
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
          <ProfileOverview
            profile={profile}
            educations={educations}
            decorations={decorations}
            adminPositions={adminPositions}
          />
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
          <div className="mt-8">
            <CorrectionRequestForm
              scope="first_review"
              onCancel={() => setMode("review")}
              onSubmitted={() => router.push("/dashboard")}
            />
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

const THAI_MONTHS_FULL = [
  "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม",
];

function formatThaiDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = THAI_MONTHS_FULL[d.getUTCMonth()];
  const yearBE = d.getUTCFullYear() + 543;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${yearBE} ${hh}:${mm} น.`;
}
