import Link from "next/link";
import {
  Sparkles,
  Plus,
  Plane,
  CalendarDays,
  Hospital,
  Briefcase,
  Baby,
  ArrowRight,
} from "lucide-react";
import { StatCard, Panel } from "./dashboard-primitives";

interface LeaveBalance {
  leaveType: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
}

interface RecentItem {
  type: "leave" | "travel";
  id: string;
  description: string;
  status: string;
  date: string;
}

interface Props {
  userName: string;
  myPendingLeaves: number;
  myPendingTravel: number;
  leaveBalances: LeaveBalance[];
  recentActivity: RecentItem[];
}

const statusBadgeTone: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-sky-50 text-sky-700 ring-sky-200",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-slate-50 text-slate-600 ring-slate-200",
};

const statusLabel: Record<string, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  completed: "เสร็จสิ้น",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
};

/**
 * Employee dashboard view — sky-toned.
 * Shows leave balance gauge, leave type tiles, recent requests, quick actions.
 */
export function EmployeeDashboard({
  userName,
  myPendingLeaves,
  myPendingTravel,
  leaveBalances,
  recentActivity,
}: Props) {
  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Vacation balance for hero gauge (first leave type with annual scope, or first balance)
  const vacation =
    leaveBalances.find((b) => /พักผ่อน|vacation/i.test(b.leaveType)) ?? leaveBalances[0];
  const leaveUsed = vacation?.usedDays ?? 0;
  const leaveTotal = vacation?.totalDays ?? 0;
  const pct = leaveTotal > 0 ? Math.min((leaveUsed / leaveTotal) * 100, 100) : 0;

  // Map leave types to tile config
  const tiles = [
    { match: /พักผ่อน|vacation/i, label: "ลาพักผ่อน", tone: "sky" as const, icon: CalendarDays },
    { match: /ป่วย|sick/i, label: "ลาป่วย", tone: "emerald" as const, icon: Hospital },
    { match: /กิจ|personal/i, label: "ลากิจ", tone: "amber" as const, icon: Briefcase },
    { match: /คลอด|maternity/i, label: "ลาคลอด", tone: "rose" as const, icon: Baby },
  ];

  const totalPending = myPendingLeaves + myPendingTravel;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 dotted-bg opacity-60"></div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-500/5 blur-3xl"></div>
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full">
              <Sparkles className="h-3 w-3" />
              <span>{today}</span>
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              สวัสดี, <span className="text-sky-600">{userName}</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 max-w-lg">
              {totalPending > 0 ? (
                <>
                  คำขอของคุณ{" "}
                  <span className="font-semibold text-slate-900">{totalPending} รายการ</span> รออนุมัติ
                </>
              ) : (
                "ไม่มีคำขอที่รอดำเนินการ"
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/leaves/new"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition"
              >
                <Plus className="h-3.5 w-3.5" /> ยื่นใบลา
              </Link>
              <Link
                href="/dashboard/travel/new"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-card border border-border text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
              >
                <Plane className="h-3.5 w-3.5" /> ขออนุญาตเดินทาง
              </Link>
            </div>
          </div>

          {leaveTotal > 0 && (
            <div className="shrink-0 w-44 h-32 rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white p-4 flex flex-col justify-between shadow-lg shadow-sky-900/20">
              <div className="text-xs font-medium text-sky-200">วันลาคงเหลือ</div>
              <div>
                <div className="text-4xl font-bold leading-none font-mono">
                  {leaveTotal - leaveUsed}
                  <span className="text-sm font-medium text-sky-200 ml-1">/{leaveTotal}</span>
                </div>
                <div className="mt-2 h-1.5 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-white/80 rounded-full" style={{ width: `${pct}%` }}></div>
                </div>
                <div className="text-[0.625rem] text-sky-200 mt-1">{vacation?.leaveType ?? "วันลา"}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leave balance tiles by type */}
      {leaveBalances.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {tiles.map((tile) => {
            const bal = leaveBalances.find((b) => tile.match.test(b.leaveType));
            if (!bal) {
              return (
                <StatCard
                  key={tile.label}
                  label={tile.label}
                  value={"—"}
                  hint="ไม่มีสิทธิ์"
                  tone={tile.tone}
                  icon={tile.icon}
                />
              );
            }
            return (
              <StatCard
                key={tile.label}
                label={tile.label}
                value={bal.remainingDays.toString()}
                sub={`/${bal.totalDays} วัน`}
                hint={`ใช้ไป ${bal.usedDays} วัน · เหลือ ${bal.remainingDays}`}
                tone={tile.tone}
                icon={tile.icon}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My recent requests */}
        <Panel
          title="คำขอล่าสุดของฉัน"
          sub="My Recent Requests"
          className="lg:col-span-2"
          action={
            <Link
              href="/dashboard/leaves"
              className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
          ) : (
            <ul className="divide-y divide-border/70 -mx-1">
              {recentActivity.slice(0, 5).map((r) => (
                <li
                  key={`${r.type}-${r.id}`}
                  className="flex items-center gap-3 py-3 px-1 hover:bg-muted/40 rounded-md"
                >
                  <div
                    className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${
                      r.type === "leave"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-violet-100 text-violet-700"
                    }`}
                  >
                    {r.type === "leave" ? (
                      <CalendarDays className="h-4 w-4" />
                    ) : (
                      <Plane className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {r.description}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(r.date).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ring-1 shrink-0 ${
                      statusBadgeTone[r.status] ?? "bg-slate-50 text-slate-600 ring-slate-200"
                    }`}
                  >
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Quick actions */}
        <Panel title="ทางลัด" sub="Quick Actions">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "ลาพักผ่อน", Ico: CalendarDays, href: "/dashboard/leaves/new", tone: "sky" },
              { label: "ลาป่วย", Ico: Hospital, href: "/dashboard/leaves/new", tone: "emerald" },
              { label: "ลากิจ", Ico: Briefcase, href: "/dashboard/leaves/new", tone: "amber" },
              { label: "เดินทาง", Ico: Plane, href: "/dashboard/travel/new", tone: "violet" },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex flex-col items-start gap-2 p-3 rounded-lg border border-border hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div
                  className={`w-8 h-8 rounded-lg bg-${a.tone}-100 text-${a.tone}-700 grid place-items-center`}
                >
                  <a.Ico className="h-[15px] w-[15px]" />
                </div>
                <div className="text-xs font-medium text-slate-800 group-hover:text-slate-900">
                  {a.label}
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
