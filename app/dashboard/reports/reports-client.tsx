"use client";

import { useState, useTransition, useMemo } from "react";
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
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  PieChartIcon,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plane,
  X,
} from "lucide-react";
import { getCalendarEvents } from "@/lib/actions/report-actions";

// ── Types ──

interface CalendarEvent {
  id: string;
  type: "leave" | "travel";
  label: string;
  person: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface ReportsProps {
  leaveByType: { name: string; pending: number; approved: number; rejected: number }[];
  travelBudget: { category: string; estimated: number; actual: number }[];
  monthlyLeaves: { month: string; count: number }[];
  initialCalendarEvents: CalendarEvent[];
  initialYear: number;
  initialMonth: number;
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const categoryLabels: Record<string, string> = {
  per_diem: "ค่าเบี้ยเลี้ยง",
  accommodation: "ค่าที่พัก",
  transportation: "ค่าพาหนะ",
  fuel_toll: "ค่าน้ำมัน/ทางด่วน",
  registration: "ค่าลงทะเบียน",
  other: "อื่นๆ",
};

const DAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

function formatCurrency(value: number) {
  return value.toLocaleString("th-TH", { minimumFractionDigits: 0 });
}

// ── Main Component ──

export function ReportsClient({
  leaveByType,
  travelBudget,
  monthlyLeaves,
  initialCalendarEvents,
  initialYear,
  initialMonth,
}: ReportsProps) {
  const [chartMode, setChartMode] = useState<"bar" | "pie">("bar");

  const totalLeaves = leaveByType.reduce((acc, r) => acc + r.pending + r.approved + r.rejected, 0);
  const pieData = leaveByType.map((r) => ({
    name: r.name,
    value: r.pending + r.approved + r.rejected,
  }));

  const budgetData = travelBudget.map((b) => ({
    ...b,
    category: categoryLabels[b.category] ?? b.category,
  }));

  const totalEstimated = travelBudget.reduce((acc, b) => acc + b.estimated, 0);
  const totalActual = travelBudget.reduce((acc, b) => acc + b.actual, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="คำขอลาทั้งหมด" value={totalLeaves.toString()} sub="รายการ" />
        <SummaryCard title="งบประมาณเดินทาง (ประมาณ)" value={`฿${formatCurrency(totalEstimated)}`} sub="บาท" />
        <SummaryCard title="งบเบิกจ่ายจริง" value={`฿${formatCurrency(totalActual)}`} sub="บาท" />
      </div>

      {/* Row 1: Leave stats (merged bar+pie) + Monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Leave by type — toggle bar / pie */}
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">สถิติการลาแยกตามประเภท</h3>
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setChartMode("bar")}
                className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${chartMode === "bar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <BarChart3 className="h-3.5 w-3.5" /> แท่ง
              </button>
              <button
                onClick={() => setChartMode("pie")}
                className={`px-2.5 py-1.5 text-xs flex items-center gap-1 transition-colors ${chartMode === "pie" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <PieChartIcon className="h-3.5 w-3.5" /> วงกลม
              </button>
            </div>
          </div>
          {leaveByType.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
          ) : chartMode === "bar" ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={leaveByType} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="approved" name="อนุมัติ" fill="#10b981" stackId="a" />
                <Bar dataKey="pending" name="รออนุมัติ" fill="#f59e0b" stackId="a" />
                <Bar dataKey="rejected" name="ไม่อนุมัติ" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
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

        {/* Monthly leaves line chart */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4">การลารายเดือน (ปีนี้)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyLeaves}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" name="จำนวนครั้ง" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Travel budget */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4">เปรียบเทียบงบประมาณเดินทาง (ประมาณ vs จริง)</h3>
        {budgetData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={budgetData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => `฿${formatCurrency(Number(value))}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="estimated" name="ประมาณการ" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="เบิกจ่ายจริง" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 3: Calendar */}
      <EventCalendar
        initialEvents={initialCalendarEvents}
        initialYear={initialYear}
        initialMonth={initialMonth}
      />
    </div>
  );
}

// ── Calendar ──

function EventCalendar({
  initialEvents,
  initialYear,
  initialMonth,
}: {
  initialEvents: CalendarEvent[];
  initialYear: number;
  initialMonth: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [events, setEvents] = useState(initialEvents);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function navigate(dir: -1 | 1) {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setYear(newYear);
    setMonth(newMonth);
    startTransition(async () => {
      const data = await getCalendarEvents(newYear, newMonth);
      setEvents(data);
    });
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const eventsOnDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          const key = d.getDate().toString();
          if (!map[key]) map[key] = [];
          map[key].push(ev);
        }
      }
    }
    return map;
  }, [events, year, month]);

  const selectedEvents = selectedDate ? eventsOnDate[selectedDate] ?? [] : [];

  const monthLabel = new Date(year, month - 1).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
  });

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">ปฏิทินการลา / เดินทาง</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} disabled={isPending}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)} disabled={isPending}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Day headers */}
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-muted/50 text-center text-xs font-medium py-2 text-muted-foreground">
            {d}
          </div>
        ))}

        {/* Empty cells */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-card min-h-[72px]" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayStr = day.toString();
          const dayEvents = eventsOnDate[dayStr] ?? [];
          const leaveCount = dayEvents.filter((e) => e.type === "leave").length;
          const travelCount = dayEvents.filter((e) => e.type === "travel").length;
          const isSelected = selectedDate === dayStr;
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() + 1 &&
            year === new Date().getFullYear();

          return (
            <button
              key={day}
              onClick={() => setSelectedDate(isSelected ? null : dayStr)}
              className={`bg-card min-h-[72px] p-1.5 text-left transition-colors hover:bg-muted/50 flex flex-col ${
                isSelected ? "ring-2 ring-primary ring-inset" : ""
              }`}
            >
              <span
                className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                {day}
              </span>
              {dayEvents.length > 0 && (
                <div className="mt-auto flex gap-1 flex-wrap">
                  {leaveCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full leading-none">
                      <CalendarDays className="h-2.5 w-2.5" />
                      {leaveCount}
                    </span>
                  )}
                  {travelCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full leading-none">
                      <Plane className="h-2.5 w-2.5" />
                      {travelCount}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> ลา
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> เดินทาง
        </span>
      </div>

      {/* Selected day detail panel */}
      {selectedDate && (
        <div className="mt-4 border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">
              {new Date(year, month - 1, Number(selectedDate)).toLocaleDateString("th-TH", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h4>
            <button onClick={() => setSelectedDate(null)} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">ไม่มีกิจกรรมในวันนี้</p>
          ) : (
            <div className="divide-y space-y-0">
              {selectedEvents.map((ev) => (
                <div key={`${ev.type}-${ev.id}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full grid place-items-center mt-0.5 ${
                      ev.type === "leave"
                        ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {ev.type === "leave" ? <CalendarDays className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ev.person}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.type === "leave" ? `ลา${ev.label}` : `เดินทาง: ${ev.label}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRange(ev.startDate, ev.endDate)}
                    </p>
                  </div>
                  <Badge
                    variant={ev.status === "approved" ? "default" : "outline"}
                    className="text-xs shrink-0"
                  >
                    {ev.status === "approved" ? "อนุมัติ" : "รออนุมัติ"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  if (s.getTime() === e.getTime()) return fmt(s);
  return `${fmt(s)} — ${fmt(e)}`;
}

// ── Helpers ──

function SummaryCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="text-xs text-muted-foreground font-medium">{title}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}
