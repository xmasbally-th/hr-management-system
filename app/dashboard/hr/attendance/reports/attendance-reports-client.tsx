"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, BarChart3, CalendarDays, Clock, LogOut, AlertTriangle } from "lucide-react";
import { thaiMonth, LEAVE_TYPE_LABELS, fiscalYearLabel } from "@/lib/attendance/labels";
import type { AttendanceAnalytics } from "@/lib/actions/attendance-actions";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

interface Props {
  analytics: AttendanceAnalytics | null;
}

export function AttendanceReportsClient({ analytics }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!analytics || analytics.buddhist_year === null) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="border border-dashed border-border rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
          ยังไม่มีข้อมูลสำหรับสร้างรายงาน
        </div>
      </div>
    );
  }

  const {
    buddhist_year,
    available_years,
    months,
    leave_by_type,
    totals,
    top_late,
    top_missing,
    top_leave,
  } = analytics;

  const yearItems = Object.fromEntries(
    available_years.map((y) => [String(y), fiscalYearLabel(y)]),
  );

  function changeYear(y: string) {
    startTransition(() => {
      router.push(`/dashboard/hr/attendance/reports?year=${y}`);
    });
  }

  const monthData = months.map((m) => ({
    name: thaiMonth(m.month).slice(0, 3),
    ลา: m.leave_total,
    มาสาย: m.late_online,
    ไม่ลงออก: m.missing_checkout,
  }));

  const pieData = leave_by_type
    .filter((l) => l.total > 0)
    .map((l) => ({ name: LEAVE_TYPE_LABELS[l.key] ?? l.key, value: l.total }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Header />
        <Select
          items={yearItems}
          value={String(buddhist_year)}
          onValueChange={(v) => v && changeYear(String(v))}
          disabled={isPending}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {available_years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                ปีงบประมาณ {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="ลารวมทั้งปีงบฯ" value={totals.leave_total} unit="วัน" icon={CalendarDays} tone="sky" />
        <Kpi label="ไปราชการรวม" value={totals.travel_days} unit="วัน" icon={BarChart3} tone="violet" />
        <Kpi label="มาสายรวม" value={totals.late_online} unit="ครั้ง" icon={Clock} tone="amber" />
        <Kpi label="ไม่ลงเวลาออกรวม" value={totals.missing_checkout} unit="ครั้ง" icon={LogOut} tone="rose" />
      </div>

      {/* Monthly trend + leave breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 border border-border rounded-lg bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">แนวโน้มรายเดือน</h3>
          {monthData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ลา" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="มาสาย" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ไม่ลงออก" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-border rounded-lg bg-card p-4">
          <h3 className="font-semibold text-sm mb-3">สัดส่วนการลาตามประเภท</h3>
          {pieData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Ranking title="มาสายมากที่สุด" unit="ครั้ง" rows={top_late} icon={Clock} tone="text-amber-600" />
        <Ranking title="ไม่ลงเวลาออกมากที่สุด" unit="ครั้ง" rows={top_missing} icon={LogOut} tone="text-rose-600" />
        <Ranking title="ลามากที่สุด" unit="วัน" rows={top_leave} icon={CalendarDays} tone="text-indigo-600" />
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function Header() {
  return (
    <div className="flex items-start gap-3">
      <Link
        href="/dashboard/hr/attendance"
        className="rounded-lg border border-border p-2 hover:bg-muted mt-0.5"
        aria-label="ย้อนกลับ"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight">สถิติรายปีงบประมาณ</h1>
        <p className="text-sm text-muted-foreground">
          สรุปสะสมจากข้อมูลรายเดือน (ดูได้แม้ยังไม่ครบ 12 เดือน) — การลา การมาสาย และการลงเวลา
        </p>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "sky" | "violet" | "amber" | "rose";
}) {
  const toneMap = {
    sky: "bg-sky-100 text-sky-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <div className="border border-border rounded-lg bg-card p-4 flex items-center gap-3">
      <div className={`rounded-lg p-2 ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold tabular-nums">
          {value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function Ranking({
  title,
  unit,
  rows,
  icon: Icon,
  tone,
}: {
  title: string;
  unit: string;
  rows: Array<{ profile_id: string; name: string; value: number }>;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon className={`h-4 w-4 ${tone}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground">ไม่มีข้อมูล</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r, i) => (
            <li key={r.profile_id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate text-sm">{r.name}</span>
              <span className="text-sm font-semibold tabular-nums">
                {r.value} <span className="text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
      <AlertTriangle className="h-4 w-4 mr-1.5 text-muted-foreground/50" />
      ไม่มีข้อมูล
    </div>
  );
}
