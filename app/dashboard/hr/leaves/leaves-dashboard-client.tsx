"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  performanceCycleRange,
  currentCycle,
  formatThai,
} from "@/lib/date-ranges";
import { getLeaveRequestsForFiscalYear } from "@/lib/actions/leave-actions";
import { exportLeaveRequests } from "@/lib/actions/export-actions";
import { downloadCsv } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  List,
  LayoutGrid,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { LeavesListView } from "./_components/leaves-list-view";
import { LeavesOverviewView } from "./_components/leaves-overview-view";

export interface LeaveTypeOption {
  id: string;
  name: string;
  code: string | null;
}

export interface PersonnelRow {
  id: string;
  full_name: string;
  position_title: string | null;
}

export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  working_days: number | null;
  status: string;
  submission_channel: string | null;
  medical_cert_url: string | null;
  leave_type_id: string;
  leave_type: { name: string; code: string | null } | null;
  employee: { full_name: string; email: string; position_title: string | null } | null;
}

interface Props {
  leaveTypes: LeaveTypeOption[];
  personnel: PersonnelRow[];
  initialRequests: Record<string, unknown>[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
}

type TabKey = "list" | "overview";

export function LeavesDashboardClient({
  leaveTypes,
  personnel,
  initialRequests,
  fiscalYearOptions,
  currentFiscalYear: defaultFy,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();

  const [rows, setRows] = useState<LeaveRequestRow[]>(
    initialRequests as unknown as LeaveRequestRow[],
  );
  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [half, setHalf] = useState<1 | 2>(currentCycle().half);
  const [tab, setTab] = useState<TabKey>("list");

  const range = useMemo(
    () => performanceCycleRange(selectedFy, half),
    [selectedFy, half],
  );

  // Requests within the active FY + round (start_date in range)
  const roundRequests = useMemo(
    () => rows.filter((r) => r.start_date >= range.start && r.start_date <= range.end),
    [rows, range.start, range.end],
  );

  function handleFyChange(fy: number) {
    setSelectedFy(fy);
    startTransition(async () => {
      try {
        const data = await getLeaveRequestsForFiscalYear(fy);
        setRows(data as unknown as LeaveRequestRow[]);
      } catch {
        toast.error("ดึงข้อมูลการลาไม่สำเร็จ");
      }
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      try {
        const data = await getLeaveRequestsForFiscalYear(selectedFy);
        setRows(data as unknown as LeaveRequestRow[]);
        toast.success("รีเฟรชข้อมูลแล้ว");
      } catch {
        toast.error("ดึงข้อมูลการลาไม่สำเร็จ");
      }
    });
  }

  function handleExport() {
    startExport(async () => {
      try {
        const data = await exportLeaveRequests();
        downloadCsv(
          "leave-requests.csv",
          ["ชื่อ-สกุล", "ประเภทลา", "วันเริ่ม", "วันสิ้นสุด", "จำนวนวัน", "สถานะ", "ช่องทาง", "วันที่ยื่น"],
          data.map((r) => [
            r.name,
            r.leaveType,
            r.startDate,
            r.endDate,
            r.totalDays.toString(),
            r.status,
            r.channel,
            r.createdAt,
          ]),
        );
      } catch {
        toast.error("ส่งออกข้อมูลไม่สำเร็จ");
      }
    });
  }

  const fyItems = useMemo(
    () =>
      Object.fromEntries(
        fiscalYearOptions.map((fy) => [String(fy), `ปีงบ ${fy + 543}`]),
      ),
    [fiscalYearOptions],
  );
  const halfItems = { "1": "รอบที่ 1", "2": "รอบที่ 2" };

  const tabs: Array<{ key: TabKey; label: string; icon: typeof List }> = [
    { key: "list", label: "รายการ", icon: List },
    { key: "overview", label: "ภาพรวม", icon: LayoutGrid },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header card ── */}
      <div className="border border-border rounded-lg bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-indigo-100 text-indigo-600 p-2">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">จัดการข้อมูลการลา</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ข้อมูลปีงบประมาณ {selectedFy + 543} | รอบที่ {half} ({formatThai(range.start)} – {formatThai(range.end)})
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Tab toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition",
                    isActive
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Filters + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={fyItems}
              value={String(selectedFy)}
              onValueChange={(v) => v && handleFyChange(Number(v))}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fiscalYearOptions.map((fy) => (
                  <SelectItem key={fy} value={String(fy)}>
                    ปีงบ {fy + 543}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={halfItems}
              value={String(half)}
              onValueChange={(v) => v && setHalf(Number(v) as 1 | 2)}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">รอบที่ 1</SelectItem>
                <SelectItem value="2">รอบที่ 2</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleRefresh}
              disabled={isPending}
              title="รีเฟรช"
            >
              <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            </Button>

            <Link href="/dashboard/hr/paper-channel/leave">
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-1.5" />
                เพิ่มข้อมูล
              </Button>
            </Link>
            <Button variant="outline" disabled title="เร็วๆ นี้">
              <Upload className="h-4 w-4 mr-1.5" />
              Import
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* ── Active view ── */}
      <div className="animate-fade-in">
        {tab === "list" ? (
          <LeavesListView requests={roundRequests} />
        ) : (
          <LeavesOverviewView
            personnel={personnel}
            leaveTypes={leaveTypes}
            requests={roundRequests}
          />
        )}
      </div>
    </div>
  );
}
