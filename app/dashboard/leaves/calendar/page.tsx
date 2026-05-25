import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COMMITTED_LEAVE_STATUSES } from "@/lib/leave-rules";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "ปฏิทินการลา" };

interface PageProps {
  searchParams?: Promise<{ m?: string }>;
}

// ─── Date helpers (local-time, ISO YYYY-MM-DD) ──────────────

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Parse "YYYY-MM" → first day of that month at local midnight. */
function parseMonth(s: string | undefined): Date {
  if (s && /^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function shiftMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const TYPE_COLORS: Record<string, string> = {
  SICK: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PERSONAL: "bg-amber-100 text-amber-800 border-amber-300",
  VACATION: "bg-sky-100 text-sky-800 border-sky-300",
  MATERNITY: "bg-rose-100 text-rose-800 border-rose-300",
};

const TH_MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default async function LeaveCalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (
    !profile ||
    (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")
  ) {
    redirect("/dashboard");
  }

  const sp = (await searchParams) ?? {};
  const monthStart = parseMonth(sp.m);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  );
  const monthStartIso = toIso(monthStart);
  const monthEndIso = toIso(monthEnd);

  // Grid spans full weeks Sun..Sat that cover this month
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back to Sunday
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())); // forward to Saturday

  // ── Fetch leaves overlapping the month ──
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select(`
      id, start_date, end_date, status,
      employee:profiles!leave_requests_employee_id_fkey(id, full_name),
      leave_type:leave_types(name, code)
    `)
    .in("status", [...COMMITTED_LEAVE_STATUSES])
    .lte("start_date", monthEndIso)
    .gte("end_date", monthStartIso)
    .order("start_date");

  // ── Fetch holidays in the month ──
  const { data: holidaysRaw } = await supabase
    .from("holidays")
    .select("date, name")
    .gte("date", monthStartIso)
    .lte("date", monthEndIso);
  const holidays = new Map<string, string>(
    (holidaysRaw ?? []).map((h) => [h.date, h.name]),
  );

  // ── Build day → leaves[] index ──
  interface DayLeaveEntry {
    id: string;
    employeeName: string;
    typeCode: string;
    typeName: string;
  }
  const byDay = new Map<string, DayLeaveEntry[]>();
  for (const l of leaves ?? []) {
    // Type narrowing — nested select returns 1-element arrays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = l as any;
    const emp = Array.isArray(r.employee) ? r.employee[0] : r.employee;
    const lt = Array.isArray(r.leave_type) ? r.leave_type[0] : r.leave_type;
    const entry: DayLeaveEntry = {
      id: r.id,
      employeeName: emp?.full_name ?? "พนักงาน",
      typeCode: lt?.code ?? "",
      typeName: lt?.name ?? "ลา",
    };
    // Iterate days overlapping [monthStart, monthEnd]
    const [ys, ms, ds] = (r.start_date as string).split("-").map(Number);
    const [ye, me, de] = (r.end_date as string).split("-").map(Number);
    const start = new Date(ys, ms - 1, ds);
    const end = new Date(ye, me - 1, de);
    const cur = new Date(Math.max(start.getTime(), monthStart.getTime()));
    const stop = new Date(Math.min(end.getTime(), monthEnd.getTime()));
    while (cur <= stop) {
      const key = toIso(cur);
      const arr = byDay.get(key) ?? [];
      arr.push(entry);
      byDay.set(key, arr);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ── Build the grid (rows of 7 days) ──
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // ── Navigation links ──
  const prevMonth = shiftMonths(monthStart, -1);
  const nextMonth = shiftMonths(monthStart, 1);
  const today = new Date();
  const todayIso = toIso(today);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-sky-600" />
          <h1 className="text-2xl font-bold tracking-tight">ปฏิทินการลา</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/leaves/calendar?m=${monthKey(prevMonth)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="px-4 py-1.5 text-sm font-semibold min-w-[12rem] text-center">
            {TH_MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear() + 543}
          </div>
          <Link
            href={`/dashboard/leaves/calendar?m=${monthKey(nextMonth)}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/leaves/calendar"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-2")}
          >
            วันนี้
          </Link>
        </div>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 text-xs font-semibold text-muted-foreground">
          {TH_WEEKDAY_SHORT.map((w) => (
            <div key={w} className="p-2 text-center border-b">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((d) => {
            const iso = toIso(d);
            const inMonth = d.getMonth() === monthStart.getMonth();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isToday = iso === todayIso;
            const holidayName = holidays.get(iso);
            const entries = byDay.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={cn(
                  "border-b border-r p-1.5 min-h-[110px] text-xs space-y-1",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-sky-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-mono",
                      isToday && "font-bold text-sky-700",
                      !isToday && isWeekend && inMonth && "text-rose-700",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {holidayName && (
                    <Badge
                      variant="outline"
                      className="text-[0.65rem] px-1 py-0 border-rose-300 text-rose-700 bg-rose-50"
                    >
                      หยุด
                    </Badge>
                  )}
                </div>
                {holidayName && (
                  <div className="text-[0.65rem] text-rose-700 truncate" title={holidayName}>
                    {holidayName}
                  </div>
                )}
                <div className="space-y-0.5">
                  {entries.slice(0, 4).map((e, i) => (
                    <Link
                      key={`${e.id}-${i}`}
                      href={`/dashboard/leaves/${e.id}`}
                      className={cn(
                        "block px-1 py-0.5 rounded border text-[0.65rem] truncate hover:opacity-80",
                        TYPE_COLORS[e.typeCode] ?? "bg-muted text-foreground border-border",
                      )}
                      title={`${e.employeeName} — ${e.typeName}`}
                    >
                      {e.employeeName}
                    </Link>
                  ))}
                  {entries.length > 4 && (
                    <div className="text-[0.65rem] text-muted-foreground px-1">
                      +{entries.length - 4} อื่น ๆ
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>คำอธิบายสี:</span>
        {Object.entries({ SICK: "ป่วย", PERSONAL: "กิจ", VACATION: "พักผ่อน", MATERNITY: "คลอด" }).map(
          ([code, label]) => (
            <span
              key={code}
              className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border", TYPE_COLORS[code])}
            >
              {label}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
