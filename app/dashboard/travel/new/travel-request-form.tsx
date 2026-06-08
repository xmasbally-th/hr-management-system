"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTravelRequest,
  type CreateTravelRequestInput,
} from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  GraduationCap,
  Plane,
  Building2,
  MapPin,
  FileText,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Monitor,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExamPeriodWarning } from "@/components/exam-period-warning";
import type { ExamPeriodLike } from "@/lib/exam-period";

type TravelType = "training" | "supervision" | "official_contact";
type Channel = "digital" | "paper";
type TabKey = "details" | "budget" | "channel";

const TRAVEL_TYPES: Array<{
  value: TravelType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "training", label: "อบรม/สัมมนา", desc: "การประชุม อบรม หลักสูตร", icon: GraduationCap },
  { value: "supervision", label: "นิเทศนักศึกษา", desc: "นิเทศ ฝึกประสบการณ์", icon: Building2 },
  { value: "official_contact", label: "ติดต่อราชการ", desc: "ติดต่องานราชการอื่น ๆ", icon: FileText },
];

// 4 fixed budget categories per design
const BUDGET_FIELDS: Array<{ key: string; label: string }> = [
  { key: "ค่าลงทะเบียน", label: "ค่าลงทะเบียน" },
  { key: "ค่าที่พัก", label: "ค่าที่พัก" },
  { key: "เบี้ยเลี้ยง", label: "เบี้ยเลี้ยง" },
  { key: "ค่าเดินทาง", label: "ค่าเดินทาง" },
];

/**
 * Travel request form — redesigned with 3-tab flow:
 *   01 รายละเอียดการเดินทาง · 02 ประมาณการค่าใช้จ่าย · 03 ช่องทาง
 *
 * Each tab validates before allowing forward navigation. The final tab shows
 * a summary table and submits either as digital (auto-routed) or paper
 * channel (HR receives a print preview).
 */
interface TravelRequestFormProps {
  examPeriods?: ExamPeriodLike[];
  hasExamDuty?: boolean;
}

export function TravelRequestForm({
  examPeriods = [],
  hasExamDuty = false,
}: TravelRequestFormProps = {}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabKey>("details");
  const [error, setError] = useState<string | null>(null);

  // Details
  const [travelType, setTravelType] = useState<TravelType | "">("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Budget — keyed by category name
  const [budget, setBudget] = useState<Record<string, string>>({
    ค่าลงทะเบียน: "",
    ค่าที่พัก: "",
    เบี้ยเลี้ยง: "",
    ค่าเดินทาง: "",
  });

  // Channel
  const [channel, setChannel] = useState<Channel>("digital");

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const d = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
    return d > 0 ? d : 0;
  }, [startDate, endDate]);

  const totalBudget = useMemo(
    () =>
      Object.values(budget).reduce((s, v) => s + (Number(v) || 0), 0),
    [budget],
  );
  const avgPerDay = totalDays > 0 ? Math.round(totalBudget / totalDays) : 0;

  // Per-tab completion check
  const detailsComplete = !!(
    travelType &&
    title.trim() &&
    location.trim() &&
    startDate &&
    endDate &&
    totalDays > 0
  );
  const budgetComplete = totalBudget > 0;

  function validateAndAdvance(target: TabKey) {
    setError(null);
    if (target === "budget" && !detailsComplete) {
      setError("กรุณากรอกรายละเอียดการเดินทางให้ครบถ้วน");
      return;
    }
    if (target === "channel" && !budgetComplete) {
      setError("กรุณากรอกประมาณการค่าใช้จ่ายอย่างน้อย 1 หมวด");
      return;
    }
    setActiveTab(target);
  }

  function handleSubmit() {
    setError(null);
    if (!detailsComplete) {
      setError("กรุณากรอกรายละเอียดการเดินทางให้ครบถ้วน");
      setActiveTab("details");
      return;
    }
    if (!budgetComplete) {
      setError("กรุณากรอกประมาณการค่าใช้จ่ายอย่างน้อย 1 หมวด");
      setActiveTab("budget");
      return;
    }

    const expenses = BUDGET_FIELDS.filter(
      (f) => Number(budget[f.key]) > 0,
    ).map((f) => ({
      expense_category: f.key,
      estimated_amount: Number(budget[f.key]),
    }));

    const input: CreateTravelRequestInput = {
      travel_type: travelType as TravelType,
      title,
      location,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      submission_channel: channel,
      expenses,
    };

    startTransition(async () => {
      try {
        await createTravelRequest(input);
        toast.success("ยื่นคำขอเดินทางเรียบร้อยแล้ว");
        router.push("/dashboard/travel");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
        setError(message);
        toast.error(message);
      }
    });
  }

  const tabs: Array<{ key: TabKey; n: string; label: string; done: boolean }> = [
    { key: "details", n: "01", label: "รายละเอียดการเดินทาง", done: detailsComplete },
    { key: "budget", n: "02", label: "ประมาณการค่าใช้จ่าย", done: budgetComplete },
    { key: "channel", n: "03", label: "ช่องทางส่งเอกสาร", done: false },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ขออนุญาตไปราชการ</h1>
        <p className="text-muted-foreground text-sm">
          กรอกข้อมูล 3 ขั้นตอน — รายละเอียด · งบประมาณ · ช่องทาง
        </p>
      </div>

      {/* Tab progress bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((t, idx) => {
          const active = activeTab === t.key;
          return (
            <div key={t.key} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => validateAndAdvance(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : t.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "w-6 h-6 rounded-full grid place-items-center text-xs font-mono",
                    active
                      ? "bg-primary text-primary-foreground"
                      : t.done
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.done && !active ? <Check className="h-3.5 w-3.5" /> : t.n}
                </span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
              {idx < tabs.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 text-destructive p-3 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Tab 01 — Details ────────────────────────────────────────── */}
      {activeTab === "details" && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 animate-fade-in">
          <div>
            <Label>ประเภทการเดินทาง *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {TRAVEL_TYPES.map((t) => {
                const Icon = t.icon;
                const active = travelType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTravelType(t.value)}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition relative",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-muted-foreground/40",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <div className="mt-2 text-sm font-semibold">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.desc}
                    </div>
                    <span
                      className={cn(
                        "absolute top-2 right-2 w-4 h-4 rounded-full border-2 grid place-items-center",
                        active ? "border-primary bg-primary" : "border-border",
                      )}
                    >
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>เรื่อง / หัวข้อ *</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น อบรมหลักสูตรฐานสมรรถนะ"
                disabled={isPending}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>สถานที่ *</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น โรงแรม xxx จ.เชียงใหม่"
                disabled={isPending}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>วันที่เริ่ม *</Label>
              <ThaiDatePicker
                value={startDate}
                onChange={setStartDate}
                disabled={isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label>วันที่สิ้นสุด *</Label>
              <ThaiDatePicker
                value={endDate}
                onChange={setEndDate}
                disabled={isPending}
              />
            </div>
          </div>

          {totalDays > 0 && (
            <div className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
              <Plane className="h-3.5 w-3.5" />
              ระยะเวลา {totalDays} วัน
            </div>
          )}

          <ExamPeriodWarning
            periods={examPeriods}
            start={startDate}
            end={endDate}
            hasDuty={hasExamDuty}
          />
        </div>
      )}

      {/* ─── Tab 02 — Budget ─────────────────────────────────────────── */}
      {activeTab === "budget" && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BUDGET_FIELDS.map((f) => (
              <div
                key={f.key}
                className="rounded-xl border border-border bg-card p-4 space-y-2"
              >
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
                    ฿
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget[f.key]}
                    onChange={(e) =>
                      setBudget({ ...budget, [f.key]: e.target.value })
                    }
                    placeholder="0.00"
                    disabled={isPending}
                    className="pl-8 font-mono text-right text-lg"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Total — indigo gradient */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-5">
            <div className="text-xs uppercase tracking-widest font-mono text-indigo-200">
              รวมงบประมาณ (ประมาณการ)
            </div>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <div className="text-4xl sm:text-5xl font-bold font-mono">
                ฿{totalBudget.toLocaleString()}
              </div>
              {totalDays > 0 && (
                <div className="text-sm text-indigo-200">
                  เฉลี่ย ฿{avgPerDay.toLocaleString()} / วัน · {totalDays} วัน
                </div>
              )}
            </div>

            {/* Breakdown bars */}
            {totalBudget > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BUDGET_FIELDS.map((f) => {
                  const v = Number(budget[f.key]) || 0;
                  const pct = totalBudget > 0 ? (v / totalBudget) * 100 : 0;
                  return (
                    <div key={f.key}>
                      <div className="text-xs text-indigo-200 truncate">
                        {f.label}
                      </div>
                      <div className="text-sm font-mono font-semibold">
                        ฿{v.toLocaleString()}
                      </div>
                      <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/80 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 03 — Channel ────────────────────────────────────────── */}
      {activeTab === "channel" && (
        <div className="space-y-5 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                {
                  v: "digital" as Channel,
                  label: "Digital Submit",
                  desc: "ส่งคำขอผ่านระบบ — ผู้อนุมัติได้รับแจ้งทันที",
                  badge: "แนะนำ",
                  icon: Monitor,
                },
                {
                  v: "paper" as Channel,
                  label: "Paper Channel (HR Input)",
                  desc: "ส่งฟอร์มกระดาษให้ HR กรอกแทน — HR จะอัปโหลดเอกสารสแกน",
                  badge: "มาตรฐาน",
                  icon: Printer,
                },
              ] as const
            ).map((c) => {
              const active = channel === c.v;
              const Icon = c.icon;
              return (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setChannel(c.v)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition relative",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-muted-foreground/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.badge}
                    </span>
                  </div>
                  <div className="mt-3 font-semibold text-sm">{c.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {c.desc}
                  </div>
                  <span
                    className={cn(
                      "absolute top-2 right-2 w-4 h-4 rounded-full border-2 grid place-items-center",
                      active ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-dashed border-border bg-card p-5">
            <div className="text-sm font-semibold mb-3">สรุปคำขอ</div>
            <dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">ประเภท</dt>
              <dd className="font-medium">
                {TRAVEL_TYPES.find((t) => t.value === travelType)?.label ?? "—"}
              </dd>
              <dt className="text-muted-foreground">เรื่อง</dt>
              <dd className="font-medium">{title || "—"}</dd>
              <dt className="text-muted-foreground">สถานที่</dt>
              <dd className="font-medium">{location || "—"}</dd>
              <dt className="text-muted-foreground">วันที่</dt>
              <dd className="font-medium">
                {startDate || "—"} ถึง {endDate || "—"}{" "}
                {totalDays > 0 && (
                  <span className="text-muted-foreground">({totalDays} วัน)</span>
                )}
              </dd>
              <dt className="text-muted-foreground">งบประมาณรวม</dt>
              <dd className="font-mono font-semibold text-primary">
                ฿{totalBudget.toLocaleString()}
              </dd>
              <dt className="text-muted-foreground">ช่องทาง</dt>
              <dd className="font-medium">
                {channel === "digital" ? "Digital" : "Paper"}
              </dd>
            </dl>
          </div>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {activeTab !== "details" && (
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                setActiveTab(activeTab === "channel" ? "budget" : "details");
              }}
              disabled={isPending}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              ย้อนกลับ
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/travel")}
            disabled={isPending}
          >
            ยกเลิก
          </Button>
          {activeTab !== "channel" ? (
            <Button
              onClick={() =>
                validateAndAdvance(activeTab === "details" ? "budget" : "channel")
              }
              disabled={isPending}
            >
              ถัดไป
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              ส่งคำขอ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
