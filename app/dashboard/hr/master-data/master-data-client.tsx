"use client";

import { useState } from "react";
import { Building2, Briefcase, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { DepartmentsSection } from "./_sections/departments-section";
import { PositionsSection } from "./_sections/positions-section";
import { LeaveTypesSection } from "./_sections/leave-types-section";

type TabKey = "departments" | "positions" | "leave-types";

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
  max_days_per_year: number;
}

interface Props {
  departments: DeptRow[];
  positions: PosRow[];
  leaveTypes: LeaveTypeRow[];
}

export function MasterDataClient({ departments, positions, leaveTypes }: Props) {
  const [active, setActive] = useState<TabKey>("departments");

  const tabs: Array<{
    key: TabKey;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: "departments", label: "หน่วยงาน", count: departments.length, icon: Building2 },
    { key: "positions", label: "ตำแหน่ง", count: positions.length, icon: Briefcase },
    { key: "leave-types", label: "ประเภทการลา", count: leaveTypes.length, icon: CalendarDays },
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
      </div>
    </div>
  );
}
