import Link from "next/link";
import { Check, Users, Clock, TrendingUp, CalendarDays, ArrowRight } from "lucide-react";
import { StatCard, Panel } from "./dashboard-primitives";
import type { ManagerDashboardData } from "@/lib/actions/report-actions";

interface Props {
  userName: string;
  data: ManagerDashboardData;
}

function formatWaiting(hours: number): string {
  if (hours < 1) return "เมื่อสักครู่";
  if (hours < 24) return `${Math.floor(hours)} ชม.`;
  const days = Math.floor(hours / 24);
  return `${days} วัน`;
}

/**
 * Manager dashboard view — violet/dark-toned.
 * Shows approval queue with inline actions, team status, monthly approvals.
 */
export function ManagerDashboard({ userName, data }: Props) {
  const totalQueue = data.pendingLeavesCount + data.pendingTravelCount;
  const onDuty = data.teamCount - data.leavesToday - data.travelToday;
  const onDutyPct = data.teamCount > 0 ? (onDuty / data.teamCount) * 100 : 0;
  const leavePct = data.teamCount > 0 ? (data.leavesToday / data.teamCount) * 100 : 0;
  const travelPct = data.teamCount > 0 ? (data.travelToday / data.teamCount) * 100 : 0;
  const oldest = data.queue[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome hero — dark violet */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-950 via-slate-900 to-slate-900 text-white">
        <div className="absolute inset-0 grid-bg opacity-60"></div>
        <div className="absolute -top-32 -left-20 w-[420px] h-[420px] rounded-full bg-violet-600/20 blur-3xl"></div>
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium text-violet-200 bg-violet-500/10 border border-violet-400/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
              <span>
                มี <span className="font-semibold text-white">{totalQueue} คำขอ</span> รอการพิจารณาของคุณ
              </span>
            </div>
            <h1 className="mt-3 text-[26px] font-bold tracking-tight">
              ภาพรวมทีม — <span className="text-violet-300">{userName}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-slate-300 max-w-lg">
              ทีมของคุณมี <span className="font-semibold text-white">{data.teamCount} คน</span> วันนี้มาทำงาน{" "}
              <span className="font-semibold text-white">{onDuty} คน</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/approvals/leaves"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-slate-900 text-[13px] font-semibold hover:bg-slate-100 transition"
              >
                <Check className="h-3.5 w-3.5" /> ตรวจสอบคำขอ ({totalQueue})
              </Link>
              <Link
                href="/dashboard/hr/users"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white/10 border border-white/20 text-white text-[13px] font-medium hover:bg-white/15 transition"
              >
                <Users className="h-3.5 w-3.5" /> ดูทีมของฉัน
              </Link>
            </div>
          </div>

          {/* Approval queue tile */}
          <div className="shrink-0 w-52 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-4">
            <div className="text-[11px] font-medium text-violet-200">คิวอนุมัติ</div>
            <div className="mt-1 text-[40px] font-bold leading-none font-mono">{totalQueue}</div>
            <div className="text-[11px] text-slate-300 mt-1">
              ใบลา {data.pendingLeavesCount} · เดินทาง {data.pendingTravelCount}
            </div>
            {oldest && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-slate-300">เก่าสุด</span>
                <span className="font-mono text-white">{formatWaiting(oldest.waitingHours)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="รออนุมัติของฉัน"
          value={totalQueue}
          hint={`ใบลา ${data.pendingLeavesCount} · เดินทาง ${data.pendingTravelCount}`}
          tone="violet"
          icon={Clock}
        />
        <StatCard label="ทีมของฉัน" value={data.teamCount} hint="ทั้งหมด" tone="slate" icon={Users} />
        <StatCard
          label="ลาวันนี้"
          value={data.leavesToday}
          hint={`ใน ${data.teamCount} คน`}
          tone="amber"
          icon={CalendarDays}
        />
        <StatCard
          label="อนุมัติเดือนนี้"
          value={data.approvalsThisMonth}
          hint="รวมใบลา + เดินทาง"
          tone="emerald"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Approval queue */}
        <Panel
          title="คิวอนุมัติของฉัน"
          sub="Pending Your Approval"
          className="lg:col-span-2"
          action={
            <Link
              href="/dashboard/approvals/leaves"
              className="text-[12px] text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {data.queue.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีคำขอรออนุมัติ</p>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {data.queue.map((q) => {
                const detailHref =
                  q.type === "leave" ? `/dashboard/leaves/${q.id}` : `/dashboard/travel/${q.id}`;
                return (
                  <li
                    key={`${q.type}-${q.id}`}
                    className="flex items-center gap-3 py-3 px-1 hover:bg-slate-50/60 rounded-md"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 grid place-items-center text-white text-[11px] font-semibold shrink-0">
                      {q.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-slate-900 truncate">
                          {q.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {q.type === "leave" ? "LV" : "TR"}-{q.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-600 truncate">{q.detail}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-[11px] font-medium ${
                          q.urgent ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        รอ {formatWaiting(q.waitingHours)}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 justify-end">
                        <Link
                          href={detailHref}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
                        >
                          ตรวจสอบ
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Team today */}
        <Panel title="ทีมวันนี้" sub="Team Status">
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <div className="text-[32px] font-bold text-slate-900 font-mono leading-none">{onDuty}</div>
              <div className="text-[12px] text-slate-500">/ {data.teamCount} มาทำงาน</div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
              <div className="bg-emerald-500" style={{ width: `${onDutyPct}%` }}></div>
              <div className="bg-amber-400" style={{ width: `${leavePct}%` }}></div>
              <div className="bg-rose-400" style={{ width: `${travelPct}%` }}></div>
            </div>
            <ul className="text-[12px] space-y-1.5 pt-1">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-700">มาทำงาน</span>
                </span>
                <span className="font-semibold text-slate-900">{onDuty}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span className="text-slate-700">ลาวันนี้</span>
                </span>
                <span className="font-semibold text-slate-900">{data.leavesToday}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span className="text-slate-700">เดินทาง</span>
                </span>
                <span className="font-semibold text-slate-900">{data.travelToday}</span>
              </li>
            </ul>
            {data.todayLeaves.length > 0 && (
              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-500 mb-2 font-medium">ลาวันนี้</div>
                <ul className="space-y-1.5">
                  {data.todayLeaves.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 grid place-items-center text-white text-[10px] font-semibold ring-2 ring-white">
                        {p.initials}
                      </div>
                      <div className="text-[12px] text-slate-700 truncate">
                        {p.name} <span className="text-slate-400">· {p.leaveType}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
