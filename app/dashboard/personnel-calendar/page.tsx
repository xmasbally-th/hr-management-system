import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  CalendarHeart,
  Thermometer,
  Briefcase,
  Palmtree,
  Baby,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMITTED_LEAVE_STATUSES, getLeaveStage } from "@/lib/leave-rules";
import { formatThai, currentFiscalYear } from "@/lib/date-ranges";
import { getDepartmentList } from "@/lib/actions/settings-actions";
import {
  getMyLeaveBalances,
  getMyLeaveCountsByType,
} from "@/lib/actions/leave-actions";
import { EventChip, type EventDetail } from "./event-chip";
import { CategoryFilter } from "./category-filter";
import { DepartmentFilter } from "./department-filter";

export const metadata = { title: "ปฏิทินงานบุคคล" };

interface PageProps {
  searchParams?: Promise<{ m?: string; dept?: string; cat?: string }>;
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

// ─── Calendar entry model (shared across event sources) ─────
// NOTE: leave/travel/training sources are added in a later step.

export type EventCategory = "holiday" | "exam" | "leave" | "travel" | "training";

interface CalendarEntry {
  category: EventCategory;
  label: string;
  /** Optional deep-link to the full detail page (leave/travel/training). */
  href?: string;
  /** Tooltip / longer description. */
  title?: string;
  /** Rich summary used by the click-through popup. */
  detail?: EventDetail;
}

/** Loosely-typed row shape — Supabase nested selects return the related
 *  record as either an object or a 1-element array depending on the join. */
interface JoinedProfile {
  id: string;
  full_name: string | null;
  department_id: string | null;
}
interface SourceRow {
  id: string;
  start_date: string;
  end_date: string;
  status?: string;
  total_days?: number;
  working_days?: number | null;
  travel_type?: string;
  title?: string;
  location?: string | null;
  course_name?: string;
  training_type?: string;
  employee?: JoinedProfile | JoinedProfile[] | null;
  leave_type?:
    | { name: string | null; code: string | null }
    | { name: string | null; code: string | null }[]
    | null;
}

/** Unwrap a nested-select relation that may be an object or 1-element array. */
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  holiday: "bg-rose-100 text-rose-800 border-rose-300",
  exam: "bg-violet-100 text-violet-800 border-violet-300",
  leave: "bg-sky-100 text-sky-800 border-sky-300",
  travel: "bg-amber-100 text-amber-800 border-amber-300",
  training: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  holiday: "วันหยุด",
  exam: "วันสอบ",
  leave: "การลา",
  travel: "เดินทางราชการ",
  training: "อบรม/สัมมนา",
};

/** Icon per leave-type code — matches the summary cards on the leaves page. */
const leaveTypeIcon: Record<string, typeof Thermometer> = {
  SICK: Thermometer,
  PERSONAL: Briefcase,
  VACATION: Palmtree,
  MATERNITY: Baby,
};

const ALL_CATEGORIES: EventCategory[] = ["holiday", "exam", "leave", "travel", "training"];

/** Parse `?cat=leave,travel` → active category set (all when absent/invalid). */
function parseCats(s: string | undefined): Set<EventCategory> {
  if (!s) return new Set(ALL_CATEGORIES);
  const picked = s
    .split(",")
    .filter((c): c is EventCategory => (ALL_CATEGORIES as string[]).includes(c));
  return picked.length ? new Set(picked) : new Set(ALL_CATEGORIES);
}

const TH_MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const TH_WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export default async function PersonnelCalendarPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  // ── Fetch every event source overlapping the month (parallel) ──
  // RLS scopes leave/travel/training automatically: employee → own rows,
  // manager+ → all rows. Leave & travel are filtered to committed statuses
  // ("shown from when HR receives into the system").
  const committed = [...COMMITTED_LEAVE_STATUSES];
  const [profileRes, departments, holidaysRes, examsRes, leavesRes, travelRes, trainingsRes] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      getDepartmentList(),
      supabase
        .from("holidays")
        .select("date, name, type, note")
        .gte("date", monthStartIso)
        .lte("date", monthEndIso),
      supabase
        .from("exam_periods")
        .select("name, start_date, end_date")
        .lte("start_date", monthEndIso)
        .gte("end_date", monthStartIso)
        .order("start_date"),
      supabase
        .from("leave_requests")
        .select(
          `id, start_date, end_date, status, total_days, working_days,
           employee:profiles!leave_requests_employee_id_fkey(id, full_name, department_id),
           leave_type:leave_types(name, code)`,
        )
        .in("status", committed)
        .lte("start_date", monthEndIso)
        .gte("end_date", monthStartIso)
        .order("start_date"),
      supabase
        .from("travel_requests")
        .select(
          `id, start_date, end_date, status, total_days, travel_type, title, location,
           employee:profiles!travel_requests_employee_id_fkey(id, full_name, department_id)`,
        )
        .in("status", committed)
        .lte("start_date", monthEndIso)
        .gte("end_date", monthStartIso)
        .order("start_date"),
      supabase
        .from("employee_trainings")
        .select(
          `id, start_date, end_date, course_name, training_type, location,
           employee:profiles!employee_trainings_employee_id_fkey(id, full_name, department_id)`,
        )
        .lte("start_date", monthEndIso)
        .gte("end_date", monthStartIso)
        .order("start_date"),
    ]);

  // ── Role + filters ──
  const role = profileRes.data?.role ?? "employee";
  const isElevated = role === "manager" || role === "hr" || role === "admin";
  // Department filter only applies for elevated roles (employees are already
  // RLS-scoped to their own rows).
  const deptFilter =
    isElevated && sp.dept && /^[0-9a-f-]{36}$/i.test(sp.dept) ? sp.dept : null;
  const activeCats = parseCats(sp.cat);
  /** Keep a leave/travel/training row only if it matches the dept filter. */
  function deptOk(emp: JoinedProfile | null): boolean {
    return !deptFilter || emp?.department_id === deptFilter;
  }

  // Leave summary cards — employees only, current fiscal year (no toggle).
  const fy = currentFiscalYear();
  const [balances, leaveCounts] =
    role === "employee"
      ? await Promise.all([getMyLeaveBalances(fy), getMyLeaveCountsByType(fy)])
      : [null, {} as Record<string, number>];

  // Same labels as the master-data holidays tab (TYPE_META).
  const holidayTypeLabel: Record<string, string> = {
    general: "ทั่วไป",
    own_closure: "มหาวิทยาลัยหยุดเอง",
    special: "พิเศษ",
  };
  interface HolidayInfo {
    name: string;
    type: string;
    note: string | null;
  }
  const holidays = activeCats.has("holiday")
    ? new Map<string, HolidayInfo>(
        (holidaysRes.data ?? []).map((h) => [
          h.date,
          { name: h.name, type: h.type ?? "general", note: h.note ?? null },
        ]),
      )
    : new Map<string, HolidayInfo>();

  // ── Build day → entries[] index ──
  const byDay = new Map<string, CalendarEntry[]>();
  function addEntry(iso: string, entry: CalendarEntry) {
    const arr = byDay.get(iso) ?? [];
    arr.push(entry);
    byDay.set(iso, arr);
  }
  /** Spread a [start,end] range across the visible month into byDay. */
  function addRange(startIso: string, endIso: string, entry: CalendarEntry) {
    const [ys, ms, ds] = startIso.split("-").map(Number);
    const [ye, me, de] = endIso.split("-").map(Number);
    const start = new Date(ys, ms - 1, ds);
    const end = new Date(ye, me - 1, de);
    const cur = new Date(Math.max(start.getTime(), monthStart.getTime()));
    const stop = new Date(Math.min(end.getTime(), monthEnd.getTime()));
    while (cur <= stop) {
      addEntry(toIso(cur), entry);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Exam periods → one chip per covered day
  if (activeCats.has("exam")) {
    for (const ex of examsRes.data ?? []) {
      addRange(ex.start_date, ex.end_date, {
        category: "exam",
        label: ex.name,
        title: `วันสอบ: ${ex.name}`,
      });
    }
  }

  // Leave requests
  for (const row of activeCats.has("leave") ? (leavesRes.data ?? []) as SourceRow[] : []) {
    const emp = pickOne(row.employee);
    if (!deptOk(emp)) continue;
    const lt = pickOne(row.leave_type);
    const name = emp?.full_name ?? "พนักงาน";
    const typeName = lt?.name ?? "การลา";
    addRange(row.start_date, row.end_date, {
      category: "leave",
      label: name,
      href: `/dashboard/leaves/${row.id}`,
      title: `${name} — ${typeName}`,
      detail: {
        heading: typeName,
        typeName,
        employeeName: name,
        dateLabel: `${formatThai(row.start_date)} – ${formatThai(row.end_date)}`,
        days: row.working_days ?? row.total_days,
        statusLabel: getLeaveStage(row.status ?? "").label,
      },
    });
  }

  // Official travel requests
  for (const row of activeCats.has("travel") ? (travelRes.data ?? []) as SourceRow[] : []) {
    const emp = pickOne(row.employee);
    if (!deptOk(emp)) continue;
    const name = emp?.full_name ?? "พนักงาน";
    addRange(row.start_date, row.end_date, {
      category: "travel",
      label: name,
      href: `/dashboard/travel/${row.id}`,
      title: `${name} — ${row.title ?? "เดินทางราชการ"}`,
      detail: {
        heading: row.title ?? "เดินทางราชการ",
        typeName: row.travel_type,
        employeeName: name,
        location: row.location ?? undefined,
        dateLabel: `${formatThai(row.start_date)} – ${formatThai(row.end_date)}`,
        days: row.total_days,
        statusLabel: getLeaveStage(row.status ?? "").label,
      },
    });
  }

  // Trainings / seminars (no status — show all)
  for (const row of activeCats.has("training") ? (trainingsRes.data ?? []) as SourceRow[] : []) {
    const emp = pickOne(row.employee);
    if (!deptOk(emp)) continue;
    const name = emp?.full_name ?? "พนักงาน";
    addRange(row.start_date, row.end_date, {
      category: "training",
      label: name,
      href: `/dashboard/trainings`,
      title: `${name} — ${row.course_name ?? "อบรม/สัมมนา"}`,
      detail: {
        heading: row.course_name ?? "อบรม/สัมมนา",
        typeName: row.training_type,
        employeeName: name,
        location: row.location ?? undefined,
        dateLabel: `${formatThai(row.start_date)} – ${formatThai(row.end_date)}`,
      },
    });
  }

  // ── Build the grid (rows of 7 days) ──
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  // ── Navigation links (preserve dept + cat filters) ──
  const prevMonth = shiftMonths(monthStart, -1);
  const nextMonth = shiftMonths(monthStart, 1);
  const today = new Date();
  const todayIso = toIso(today);
  function buildHref(month: string | null): string {
    const params = new URLSearchParams();
    if (month) params.set("m", month);
    if (sp.dept) params.set("dept", sp.dept);
    if (sp.cat) params.set("cat", sp.cat);
    const qs = params.toString();
    return `/dashboard/personnel-calendar${qs ? `?${qs}` : ""}`;
  }
  const prevHref = buildHref(monthKey(prevMonth));
  const nextHref = buildHref(monthKey(nextMonth));
  const todayHref = buildHref(null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarHeart className="h-5 w-5 text-indigo-600" />
          <h1 className="text-2xl font-bold tracking-tight">ปฏิทินงานบุคคล</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isElevated && (
            <DepartmentFilter departments={departments} selected={deptFilter} />
          )}
          <div className="flex items-center gap-1">
            <Link
              href={prevHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <div className="px-4 py-1.5 text-sm font-semibold min-w-[12rem] text-center">
              {TH_MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear() + 543}
            </div>
            <Link
              href={nextHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href={todayHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-2")}
            >
              วันนี้
            </Link>
          </div>
        </div>
      </div>

      {/* Leave summary cards — employee self-view, current fiscal year */}
      {role === "employee" && balances && balances.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="self-center text-xs text-muted-foreground">
            สรุปวันลา ปีงบ {fy + 543}:
          </span>
          {balances.map((b) => {
            const lt = b.leave_type as { name: string; code: string | null } | null;
            const Icon = leaveTypeIcon[lt?.code ?? ""] ?? CalendarDays;
            const count = leaveCounts[b.leave_type_id as string] ?? 0;
            return (
              <div
                key={b.id}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 min-w-[180px]"
              >
                <div className="rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{lt?.name ?? "วันลา"}</p>
                  <p className="text-sm">
                    <span className="font-bold">{b.used_days}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      / {b.total_days} วัน · {count} ครั้ง
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CategoryFilter active={[...activeCats]} />

      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 text-xs font-semibold text-muted-foreground">
          {TH_WEEKDAY_SHORT.map((w) => (
            <div key={w} className="p-2 text-center border-b">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = toIso(d);
            const inMonth = d.getMonth() === monthStart.getMonth();
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isToday = iso === todayIso;
            const holiday = holidays.get(iso);
            const entries = byDay.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={cn(
                  "border-b border-r p-1.5 min-h-[110px] text-xs space-y-1",
                  !inMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-indigo-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "font-mono",
                      isToday && "font-bold text-indigo-700",
                      !isToday && isWeekend && inMonth && "text-rose-700",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {holiday && (
                    <Badge
                      variant="outline"
                      className="text-[0.65rem] px-1 py-0 border-rose-300 text-rose-700 bg-rose-50"
                    >
                      หยุด
                    </Badge>
                  )}
                </div>
                {holiday && (
                  <EventChip
                    label={holiday.name}
                    colorClass={CATEGORY_COLORS.holiday}
                    categoryLabel={CATEGORY_LABELS.holiday}
                    detail={{
                      heading: holiday.name,
                      typeName: holidayTypeLabel[holiday.type] ?? holiday.type,
                      dateLabel: formatThai(iso),
                      note: holiday.note ?? undefined,
                    }}
                  />
                )}
                <div className="space-y-0.5">
                  {entries.slice(0, 4).map((e, i) =>
                    e.detail ? (
                      <EventChip
                        key={`${e.category}-${i}`}
                        label={e.label}
                        colorClass={CATEGORY_COLORS[e.category]}
                        categoryLabel={CATEGORY_LABELS[e.category]}
                        detail={e.detail}
                        href={e.href}
                      />
                    ) : (
                      <div
                        key={`${e.category}-${i}`}
                        className={cn(
                          "block px-1 py-0.5 rounded border text-[0.65rem] truncate",
                          CATEGORY_COLORS[e.category],
                        )}
                        title={e.title ?? e.label}
                      >
                        {e.label}
                      </div>
                    ),
                  )}
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
    </div>
  );
}
