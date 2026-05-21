"use client";

import { useState } from "react";
import {
  Building2,
  Briefcase,
  CalendarDays,
  IdCard,
  GraduationCap,
  Award,
  Settings2,
  CalendarCheck2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DepartmentsSection } from "./_sections/departments-section";
import { PositionsSection } from "./_sections/positions-section";
import { LeaveTypesSection } from "./_sections/leave-types-section";
import { EmployeeTypesSection } from "./_sections/employee-types-section";
import { EducationLevelsSection } from "./_sections/education-levels-section";
import { DecorationCatalogSection } from "./_sections/decoration-catalog-section";
import { LeaveSettingsSection } from "./_sections/leave-settings-section";
import { HolidaysSection } from "./_sections/holidays-section";

type TabKey =
  | "departments"
  | "positions"
  | "leave-types"
  | "leave-settings"
  | "holidays"
  | "employee-types"
  | "education-levels"
  | "decoration-catalog";

interface DeptRow {
  id: string;
  name: string;
}
interface PosRow {
  id: string;
  name: string;
  department_id: string;
  department?: { name: string } | null;
}
interface LeaveTypeRow {
  id: string;
  name: string;
  code?: string | null;
  max_days_per_year: number;
}
interface HolidayRow {
  id: string;
  date: string;
  name: string;
  fiscal_year: number;
}
interface NameOrderRow {
  id: string;
  name: string;
  sort_order: number;
}
interface DecorationCatalogRow {
  id: string;
  name: string;
  abbreviation: string | null;
  sort_order: number;
}

interface Props {
  departments: DeptRow[];
  positions: PosRow[];
  leaveTypes: LeaveTypeRow[];
  leaveOnlineEnabled: boolean;
  holidays: HolidayRow[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
  employeeTypes: NameOrderRow[];
  educationLevels: NameOrderRow[];
  decorationCatalog: DecorationCatalogRow[];
}

export function MasterDataClient({
  departments,
  positions,
  leaveTypes,
  leaveOnlineEnabled,
  holidays,
  fiscalYearOptions,
  currentFiscalYear: curFy,
  employeeTypes,
  educationLevels,
  decorationCatalog,
}: Props) {
  const [active, setActive] = useState<TabKey>("departments");

  const tabs: Array<{
    key: TabKey;
    label: string;
    count: number | null;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: "departments", label: "หน่วยงาน", count: departments.length, icon: Building2 },
    { key: "positions", label: "ตำแหน่ง", count: positions.length, icon: Briefcase },
    { key: "leave-types", label: "ประเภทการลา", count: leaveTypes.length, icon: CalendarDays },
    { key: "leave-settings", label: "ตั้งค่าการลา", count: null, icon: Settings2 },
    { key: "holidays", label: "วันหยุดราชการ", count: holidays.length, icon: CalendarCheck2 },
    { key: "employee-types", label: "ประเภทบุคลากร", count: employeeTypes.length, icon: IdCard },
    { key: "education-levels", label: "วุฒิการศึกษา", count: educationLevels.length, icon: GraduationCap },
    { key: "decoration-catalog", label: "เครื่องราชฯ", count: decorationCatalog.length, icon: Award },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
              {t.count !== null && (
                <span
                  className={cn(
                    "ml-1 text-[0.625rem] font-mono px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in">
        {active === "departments" && <DepartmentsSection rows={departments} />}
        {active === "positions" && (
          <PositionsSection rows={positions} departments={departments} />
        )}
        {active === "leave-types" && <LeaveTypesSection rows={leaveTypes} />}
        {active === "leave-settings" && <LeaveSettingsSection enabled={leaveOnlineEnabled} />}
        {active === "holidays" && (
          <HolidaysSection
            rows={holidays}
            fiscalYearOptions={fiscalYearOptions}
            currentFiscalYear={curFy}
          />
        )}
        {active === "employee-types" && <EmployeeTypesSection rows={employeeTypes} />}
        {active === "education-levels" && <EducationLevelsSection rows={educationLevels} />}
        {active === "decoration-catalog" && <DecorationCatalogSection rows={decorationCatalog} />}
      </div>
    </div>
  );
}
