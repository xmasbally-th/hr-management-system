"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  GraduationCap,
  Award,
  Briefcase,
  Eye,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileOverview } from "@/components/profile-overview";
import { IdentitySection } from "@/app/dashboard/profile/_sections/identity-section";
import { EducationSection } from "@/app/dashboard/profile/_sections/education-section";
import { DecorationsSection } from "@/app/dashboard/profile/_sections/decorations-section";
import { AdminPositionsSection } from "@/app/dashboard/profile/_sections/admin-positions-section";

type TabKey =
  | "overview"
  | "identity"
  | "education"
  | "decorations"
  | "admin";

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
}

interface Props {
  targetUserId: string;
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
  pre_registered: { label: "ยังไม่เข้าระบบ", cls: "bg-slate-50 text-slate-700 border-slate-200" },
  awaiting_confirmation: { label: "รอยืนยันข้อมูล", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  awaiting_correction: { label: "รอการแก้ไข", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function EditUserClient({
  targetUserId,
  profile,
  educations,
  decorations,
  adminPositions,
  departments,
  employeeTypes,
  educationLevels,
  decorationCatalog,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const status = STATUS_LABEL[profile.status as string] ?? {
    label: profile.status,
    cls: "",
  };

  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { key: "overview", label: "ภาพรวม", icon: Eye },
    { key: "identity", label: "ข้อมูลส่วนตัว", icon: User },
    { key: "education", label: "ประวัติการศึกษา", icon: GraduationCap, count: educations.length },
    { key: "decorations", label: "เครื่องราชอิสริยาภรณ์", icon: Award, count: decorations.length },
    { key: "admin", label: "ประวัติการบริหาร", icon: Briefcase, count: adminPositions.length },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          href="/dashboard/hr/users"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4 mr-1.5" />
          กลับไปรายชื่อผู้ใช้
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">แก้ไขโปรไฟล์ผู้ใช้</h1>
        <p className="text-muted-foreground text-sm">
          แก้ไขข้อมูลในนามของผู้ใช้ — การเปลี่ยนแปลงทุกครั้งจะถูกบันทึกใน audit log
          และส่งการแจ้งเตือนให้ผู้ใช้ทราบ
        </p>
      </div>

      {/* HR notice banner */}
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-900">
            คุณกำลังแก้ไขในฐานะ HR/Admin — การบันทึกจะใช้งานทันที (ไม่ต้องผ่านการอนุมัติ)
          </div>
        </div>
      </div>

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-border shadow-sm shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 grid place-items-center text-white text-2xl font-semibold ring-2 ring-border shadow-sm shrink-0">
              {(profile.full_name ?? profile.email)
                .split(" ")
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-2">
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
        <div className="animate-fade-in">
          <ProfileOverview
            profile={profile}
            educations={educations}
            decorations={decorations}
            adminPositions={adminPositions}
            onSectionEditClick={(section) => {
              // Map section keys to tabs
              if (section === "identity" || section === "position") {
                setActiveTab("identity");
              } else if (section === "educations") {
                setActiveTab("education");
              } else if (section === "decorations") {
                setActiveTab("decorations");
              } else if (section === "admin_positions") {
                setActiveTab("admin");
              }
            }}
          />
        </div>
      )}

      {activeTab !== "overview" && (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 animate-fade-in">
          {activeTab === "identity" && (
            <IdentitySection
              profile={profile}
              departments={departments}
              employeeTypes={employeeTypes}
              educationLevels={educationLevels}
              targetUserId={targetUserId}
            />
          )}
          {activeTab === "education" && (
            <EducationSection
              rows={educations}
              educationLevels={educationLevels}
              targetUserId={targetUserId}
            />
          )}
          {activeTab === "decorations" && (
            <DecorationsSection
              rows={decorations}
              catalog={decorationCatalog}
              targetUserId={targetUserId}
            />
          )}
          {activeTab === "admin" && (
            <AdminPositionsSection
              rows={adminPositions}
              targetUserId={targetUserId}
            />
          )}
        </div>
      )}
    </div>
  );
}
