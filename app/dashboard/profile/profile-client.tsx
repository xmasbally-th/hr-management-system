"use client";

import { useMemo, useState } from "react";
import { AvatarUpload } from "@/components/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Bell,
  Pencil,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProfileOverview,
  type SectionKey,
} from "@/components/profile-overview";
import {
  CorrectionRequestForm,
  FIELD_LABELS,
  SECTION_FIELDS,
} from "@/components/correction-request-form";
import { NotificationsSection } from "./_sections/notifications-section";
import type { NotificationType } from "@/lib/notification-types";

type TabKey = "overview" | "history" | "notifications";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
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
  department_id?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  education_level?: string | null;
  current_address?: string | null;
  department?: { id: string; name: string } | null;
  [key: string]: unknown;
}

interface HistoryItem {
  id: string;
  reason_text: string;
  fields_flagged: string[];
  scope: "first_review" | "post_approval";
  status: "pending" | "resolved" | "rejected" | "cancelled";
  resolver_note: string | null;
  resolved_at: string | null;
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
    document_reference: string | null;
    approved_date: string | null;
    position_at_grant: string | null;
  }>;
  adminPositions: Array<{
    id: string;
    appointment_order_number: string | null;
    position_title: string;
    responsible_unit: string | null;
    start_date: string;
    end_date: string | null;
  }>;
  notificationPrefs: Record<NotificationType, boolean>;
  /** Pending correction-request count — drives disable state of "ขอแก้" buttons */
  pendingCorrectionsCount: number;
  /** Most-recent correction requests (any status) — for the "ประวัติคำขอ" tab */
  correctionHistory: HistoryItem[];
}

const ROLE_LABEL: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  hr: "เจ้าหน้าที่ HR",
  manager: "ผู้จัดการ",
  employee: "พนักงาน",
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: "ใช้งานปกติ", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "รออนุมัติ", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  rejected: { label: "ระงับ", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  awaiting_confirmation: { label: "รอยืนยันข้อมูล", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pre_registered: { label: "ยังไม่เข้าระบบ", cls: "bg-slate-50 text-slate-700 border-slate-200" },
};

const COMPLETION_FIELDS = [
  "title_th","first_name_th","last_name_th",
  "title_en","first_name_en","last_name_en",
  "phone","position_number","position_title",
  "employee_type","department_id","education_level",
  "birth_date","hire_date","gender","current_address","avatar_url",
] as const;

const STATUS_META: Record<
  HistoryItem["status"],
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  pending: {
    label: "รอดำเนินการ",
    cls: "bg-amber-50 text-amber-800 border-amber-200",
    icon: Clock,
  },
  resolved: {
    label: "ดำเนินการแล้ว",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "ปฏิเสธ",
    cls: "bg-rose-50 text-rose-800 border-rose-200",
    icon: XCircle,
  },
  cancelled: {
    label: "ยกเลิก",
    cls: "bg-slate-50 text-slate-700 border-slate-200",
    icon: Ban,
  },
};

export function ProfileClient({
  profile,
  educations,
  decorations,
  adminPositions,
  notificationPrefs,
  pendingCorrectionsCount,
  correctionHistory,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [initialFields, setInitialFields] = useState<string[]>([]);

  const completionPct = useMemo(() => {
    const filled = COMPLETION_FIELDS.filter(
      (f) => profile[f] && String(profile[f]).trim().length > 0,
    ).length;
    return Math.round((filled / COMPLETION_FIELDS.length) * 100);
  }, [profile]);

  const initials = useMemo(() => {
    const name = profile.full_name ?? profile.email;
    return name
      .split(" ")
      .map((n: string) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [profile.full_name, profile.email]);

  const status = STATUS_LABEL[profile.status as string] ?? {
    label: profile.status,
    cls: "",
  };

  const hasPending = pendingCorrectionsCount > 0;
  const editDisabledReason = hasPending
    ? "มีคำขอแก้ไขรอ HR ดำเนินการอยู่แล้ว — โปรดรอให้เสร็จก่อนส่งใหม่"
    : undefined;

  function openCorrectionDialog(sectionKey?: SectionKey) {
    setInitialFields(sectionKey ? SECTION_FIELDS[sectionKey] ?? [] : []);
    setCorrectionOpen(true);
  }

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { key: "overview", label: "ภาพรวม", icon: Eye },
    {
      key: "history",
      label: "ประวัติคำขอ",
      icon: History,
      count: correctionHistory.length || undefined,
    },
    { key: "notifications", label: "การแจ้งเตือน", icon: Bell },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">โปรไฟล์ของฉัน</h1>
        <p className="text-muted-foreground text-sm">
          ข้อมูลที่ฝ่ายบุคคลบันทึกไว้ในระบบ — หากต้องการแก้ไข
          กรุณาส่งคำขอให้ฝ่ายบุคคลดำเนินการ
        </p>
      </div>

      {/* Header card — avatar + name + status + completion */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <AvatarUpload
            currentUrl={profile.avatar_url}
            userId={profile.id}
            initials={initials}
          />
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="text-lg font-semibold">{profile.full_name}</div>
              <div className="text-sm text-muted-foreground font-mono">{profile.email}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </Badge>
              <Badge variant="outline" className={status.cls}>
                {status.label}
              </Badge>
              {profile.department?.name && (
                <Badge variant="outline">{profile.department.name}</Badge>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">ข้อมูลครบถ้วน</span>
                <span className="font-mono font-semibold">{completionPct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    completionPct >= 80
                      ? "bg-emerald-500"
                      : completionPct >= 50
                        ? "bg-amber-500"
                        : "bg-rose-500",
                  )}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "ml-1 text-[0.625rem] font-mono px-1.5 py-0.5 rounded-full",
                    active ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "overview" && (
        <div className="space-y-4 animate-fade-in">
          {!correctionOpen && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4">
              <div>
                <div className="font-semibold text-sm">ต้องการแก้ไขข้อมูล?</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ส่งคำขอเพื่อให้ฝ่ายบุคคลตรวจสอบและดำเนินการให้
                  หรือคลิก &quot;ขอแก้&quot; ที่ส่วนใดส่วนหนึ่งด้านล่าง
                </p>
              </div>
              <Button
                onClick={() => openCorrectionDialog()}
                disabled={hasPending}
                title={editDisabledReason}
              >
                <Pencil className="size-4 mr-2" />
                ขอแก้ไขข้อมูล
              </Button>
            </div>
          )}

          {correctionOpen && (
            <CorrectionRequestForm
              scope="post_approval"
              initialFields={initialFields}
              onCancel={() => setCorrectionOpen(false)}
              onSubmitted={() => setCorrectionOpen(false)}
            />
          )}

          <ProfileOverview
            profile={profile}
            educations={educations}
            decorations={decorations}
            adminPositions={adminPositions}
            onSectionEditClick={openCorrectionDialog}
            editDisabled={hasPending || correctionOpen}
            editDisabledReason={editDisabledReason}
          />
        </div>
      )}

      {activeTab === "history" && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 animate-fade-in">
          <CorrectionHistoryList items={correctionHistory} />
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 animate-fade-in">
          <NotificationsSection initialPrefs={notificationPrefs} />
        </div>
      )}
    </div>
  );
}

// ─── History list ───────────────────────────────────────────────────

const THAI_MONTHS = [
  "ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.",
  "ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค.",
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]} ${(d.getUTCFullYear() + 543) % 100}`;
}

function CorrectionHistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground italic">
        ยังไม่มีประวัติคำขอแก้ไข
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">ประวัติคำขอแก้ไขข้อมูล</h3>
      <ul className="space-y-3">
        {items.map((it) => {
          const meta = STATUS_META[it.status];
          const Icon = meta.icon;
          return (
            <li
              key={it.id}
              className="rounded-lg border border-border p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
                      meta.cls,
                    )}
                  >
                    <Icon className="size-3" />
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {it.scope === "first_review"
                      ? "ตรวจสอบครั้งแรก"
                      : "แก้ไขเพิ่มเติม"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  ส่ง {formatDate(it.created_at)}
                  {it.resolved_at && <> · จบ {formatDate(it.resolved_at)}</>}
                </span>
              </div>
              {it.fields_flagged.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {it.fields_flagged.map((k) => (
                    <span
                      key={k}
                      className="inline-flex items-center px-1.5 py-px rounded text-xs bg-muted text-muted-foreground"
                    >
                      {FIELD_LABELS[k] ?? k}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {it.reason_text}
              </p>
              {it.resolver_note && (
                <div className="mt-2 rounded bg-muted/50 border border-border px-3 py-2 text-xs">
                  <span className="font-medium text-muted-foreground">
                    หมายเหตุจาก HR:
                  </span>{" "}
                  {it.resolver_note}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
