"use client";

import { useMemo, useState } from "react";
import { AvatarUpload } from "@/components/avatar-upload";
import { Badge } from "@/components/ui/badge";
import {
  User,
  GraduationCap,
  Award,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { IdentitySection } from "./_sections/identity-section";
import { EducationSection } from "./_sections/education-section";
import { DecorationsSection } from "./_sections/decorations-section";
import { AdminPositionsSection } from "./_sections/admin-positions-section";

type TabKey = "identity" | "education" | "decorations" | "admin";

// Loose profile shape — the underlying row has many optional/nullable fields
// and a joined `department`. We accept anything matching this loose contract.
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

interface Props {
  profile: Profile;
  educations: Array<{
    id: string;
    entry_year: number | null;
    graduation_year: number | null;
    institution: string;
    country: string | null;
    degree: string;
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
  departments: Array<{ id: string; name: string }>;
  employeeTypes: string[];
  educationLevels: string[];
  decorationCatalog: Array<{ name: string; abbreviation: string | null }>;
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
};

// Track which optional fields contribute to completion %
const COMPLETION_FIELDS = [
  "title_th",
  "first_name_th",
  "last_name_th",
  "title_en",
  "first_name_en",
  "last_name_en",
  "phone",
  "position_number",
  "position_title",
  "employee_type",
  "department_id",
  "education_level",
  "birth_date",
  "hire_date",
  "gender",
  "current_address",
  "avatar_url",
] as const;

export function ProfileClient({
  profile,
  educations,
  decorations,
  adminPositions,
  departments,
  employeeTypes,
  educationLevels,
  decorationCatalog,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

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

  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { key: "identity", label: "ข้อมูลส่วนตัว", icon: User },
    { key: "education", label: "ประวัติการศึกษา", icon: GraduationCap, count: educations.length },
    { key: "decorations", label: "เครื่องราชอิสริยาภรณ์", icon: Award, count: decorations.length },
    { key: "admin", label: "ประวัติการบริหาร", icon: Briefcase, count: adminPositions.length },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">โปรไฟล์ของฉัน</h1>
        <p className="text-muted-foreground text-sm">
          จัดการข้อมูลส่วนตัว ตำแหน่ง รูปภาพ และประวัติของคุณ
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
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6 animate-fade-in">
        {activeTab === "identity" && (
          <IdentitySection
            profile={profile}
            departments={departments}
            employeeTypes={employeeTypes}
            educationLevels={educationLevels}
          />
        )}
        {activeTab === "education" && <EducationSection rows={educations} />}
        {activeTab === "decorations" && (
          <DecorationsSection rows={decorations} catalog={decorationCatalog} />
        )}
        {activeTab === "admin" && <AdminPositionsSection rows={adminPositions} />}
      </div>
    </div>
  );
}
