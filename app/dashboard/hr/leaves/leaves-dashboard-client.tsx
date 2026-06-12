"use client";

import { type ComponentProps, useMemo, useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
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
  ListTodo,
  List,
  LayoutGrid,
  FolderSearch,
  Plus,
  Upload,
  Download,
  RefreshCw,
  Loader2,
  PenLine,
} from "lucide-react";
import { toast } from "sonner";
import { LeavesOverviewView } from "./_components/leaves-overview-view";
import { LeaveRequestTable, type LeaveRequestRow } from "@/components/leave-request-table";
import { HrDocumentsClient, type DocRefInfo } from "@/app/dashboard/hr/documents/hr-documents-client";

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

type DocumentRows = ComponentProps<typeof HrDocumentsClient>["documents"];

interface MyQueue {
  labels: string[];
  count: number;
  statuses: string[];
}

interface Props {
  leaveTypes: LeaveTypeOption[];
  personnel: PersonnelRow[];
  initialRequests: Record<string, unknown>[];
  fiscalYearOptions: number[];
  currentFiscalYear: number;
  /** Viewer role — gates tabs (overview/edit) and header actions. */
  role: string;
  /** Leave document_tracking rows for the ติดตามเอกสาร tab. */
  documents: DocumentRows;
  docRefInfo: Record<string, DocRefInfo>;
  /** Designated-signer queue banner (null when viewer signs no stage). */
  myQueue: MyQueue | null;
  /** Statuses this viewer must act on — drives the "รอดำเนินการ" tab. */
  actionStatuses: string[];
}

type TabKey = "pending" | "all" | "overview" | "documents";

/**
 * Coarse status filter buckets for the "คำขอทั้งหมด" tab. Only `completed`
 * counts as done — `approved`/`awaiting_university` are still mid-process
 * (the university step remains), so they stay in "กำลังดำเนินการ".
 */
function statusGroup(status: string): string {
  if (status === "rejected") return "rejected";
  if (status === "cancelled") return "cancelled";
  if (status === "completed") return "done";
  return "in_progress";
}

const STATUS_FILTERS: [string, string][] = [
  ["all", "ทุกสถานะ"],
  ["in_progress", "กำลังดำเนินการ"],
  ["done", "เสร็จสิ้น"],
  ["rejected", "ไม่อนุมัติ"],
  ["cancelled", "ยกเลิก"],
];

export function LeavesDashboardClient({
  leaveTypes,
  personnel,
  initialRequests,
  fiscalYearOptions,
  currentFiscalYear: defaultFy,
  role,
  documents,
  docRefInfo,
  myQueue,
  actionStatuses,
}: Props) {
  const isHrAdmin = role === "hr" || role === "admin";
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();

  const [rows, setRows] = useState<LeaveRequestRow[]>(
    initialRequests as unknown as LeaveRequestRow[],
  );
  const [selectedFy, setSelectedFy] = useState(defaultFy);
  const [half, setHalf] = useState<1 | 2>(currentCycle().half);
  const [tab, setTab] = useState<TabKey>("pending");
  const [statusFilter, setStatusFilter] = useState("all");

  const range = useMemo(
    () => performanceCycleRange(selectedFy, half),
    [selectedFy, half],
  );

  // Requests within the active FY + round (start_date in range)
  const roundRequests = useMemo(
    () => rows.filter((r) => r.start_date >= range.start && r.start_date <= range.end),
    [rows, range.start, range.end],
  );

  // Only requests at a stage this viewer must act on (role + signer stages).
  const actionSet = useMemo(() => new Set(actionStatuses), [actionStatuses]);
  const pendingRequests = useMemo(
    () => roundRequests.filter((r) => actionSet.has(r.status)),
    [roundRequests, actionSet],
  );

  const allFiltered = useMemo(
    () =>
      statusFilter === "all"
        ? roundRequests
        : roundRequests.filter((r) => statusGroup(r.status) === statusFilter),
    [roundRequests, statusFilter],
  );

  const fyItems = useMemo(
    () =>
      Object.fromEntries(fiscalYearOptions.map((fy) => [String(fy), `ปีงบ ${fy + 543}`])),
    [fiscalYearOptions],
  );
  const halfItems = { "1": "รอบที่ 1", "2": "รอบที่ 2" };

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

  const tabs: Array<{ key: TabKey; label: string; icon: typeof List }> = [
    { key: "pending", label: "รอดำเนินการ", icon: ListTodo },
    { key: "all", label: "คำขอทั้งหมด", icon: List },
    ...(isHrAdmin
      ? [{ key: "overview" as const, label: "ภาพรวม", icon: LayoutGrid }]
      : []),
    { key: "documents", label: "ติดตามเอกสาร", icon: FolderSearch },
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
            <h1 className="font-semibold text-lg">จัดการใบลา</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ข้อมูลปีงบประมาณ {selectedFy + 543} | รอบที่ {half} ({formatThai(range.start)} – {formatThai(range.end)})
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Tab toggle */}
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted">
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

            {isHrAdmin && (
              <>
                <Link href="/dashboard/hr/paper-channel/leave">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Plus className="h-4 w-4 mr-1.5" />
                    เพิ่มใบลา (กระดาษ)
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Designated-signer queue banner (only when work awaits) ── */}
      {myQueue && myQueue.count > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 flex items-center justify-between gap-4 flex-wrap dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 text-sm text-violet-900 dark:text-violet-200">
            <PenLine className="h-4 w-4 shrink-0" />
            <span>
              คุณเป็นผู้ลงนามระดับ <b>{myQueue.labels.join(" / ")}</b> — มี{" "}
              <b>{myQueue.count}</b> คำขอรอการลงนามของคุณ
            </span>
          </div>
        </div>
      )}

      {/* ── Active view ── */}
      <div className="animate-fade-in">
        {tab === "pending" && (
          <LeaveRequestTable
            requests={pendingRequests}
            emptyText={
              actionStatuses.length === 0
                ? "ไม่มีงานที่รอตำแหน่งของคุณดำเนินการ — ดูคำขอทั้งหมดได้ที่แท็บถัดไป"
                : "ไม่มีคำขอที่รอคุณดำเนินการในรอบนี้"
            }
          />
        )}
        {tab === "all" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(([value, label]) => (
                <Button
                  key={value}
                  variant={statusFilter === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {value === "all"
                      ? roundRequests.length
                      : roundRequests.filter((r) => statusGroup(r.status) === value).length}
                  </Badge>
                </Button>
              ))}
            </div>
            <LeaveRequestTable requests={allFiltered} emptyText="ไม่มีคำขอลาในรอบนี้" />
          </div>
        )}
        {tab === "overview" && isHrAdmin && (
          <LeavesOverviewView
            personnel={personnel}
            leaveTypes={leaveTypes}
            requests={roundRequests}
          />
        )}
        {tab === "documents" && (
          <HrDocumentsClient
            documents={documents}
            refInfo={docRefInfo}
            readOnly={!isHrAdmin}
          />
        )}
      </div>
    </div>
  );
}
