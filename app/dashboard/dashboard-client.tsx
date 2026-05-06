"use client";

import Link from "next/link";
import {
  Sparkles,
  CalendarDays,
  Plane,
  Users,
  ClipboardCheck,
  Bell,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DashboardProps {
  userName: string;
  stats: {
    role: string;
    totalEmployees: number;
    pendingLeaves: number;
    pendingTravel: number;
    myPendingLeaves: number;
    myPendingTravel: number;
    unreadNotifications: number;
  };
  leaveBalances: {
    leaveType: string;
    totalDays: number;
    usedDays: number;
    remainingDays: number;
  }[];
  recentActivity: {
    type: "leave" | "travel";
    id: string;
    description: string;
    status: string;
    date: string;
  }[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "outline" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  completed: { label: "เสร็จสิ้น", variant: "secondary" },
};

export function DashboardClient({ userName, stats, leaveBalances, recentActivity }: DashboardProps) {
  const isHrOrAbove = stats.role === "hr" || stats.role === "admin" || stats.role === "manager";

  const today = new Date().toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalPendingApprovals = stats.pendingLeaves + stats.pendingTravel;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="absolute inset-0 dotted-bg opacity-60"></div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl"></div>

        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              <Sparkles size={12} />
              <span>{today}</span>
            </div>
            <h1 className="mt-3 text-[22px] sm:text-[26px] font-bold text-foreground tracking-tight">
              ยินดีต้อนรับกลับ, <span className="text-primary">{userName}</span>
            </h1>
            <p className="mt-1.5 text-[14px] text-muted-foreground max-w-lg">
              {isHrOrAbove && totalPendingApprovals > 0 && (
                <>
                  คุณมี <span className="font-semibold text-foreground">{totalPendingApprovals} รายการ</span> รออนุมัติ
                  {stats.unreadNotifications > 0 && (
                    <> และ <span className="font-semibold text-foreground">{stats.unreadNotifications} การแจ้งเตือน</span> ที่ยังไม่ได้อ่าน</>
                  )}
                </>
              )}
              {isHrOrAbove && totalPendingApprovals === 0 && "ไม่มีรายการรออนุมัติ"}
              {!isHrOrAbove && (
                <>
                  {stats.myPendingLeaves + stats.myPendingTravel > 0
                    ? <>คุณมี <span className="font-semibold text-foreground">{stats.myPendingLeaves + stats.myPendingTravel} คำขอ</span> ที่รอดำเนินการ</>
                    : "ไม่มีคำขอค้างอยู่"}
                  {stats.unreadNotifications > 0 && (
                    <> · <span className="font-semibold text-foreground">{stats.unreadNotifications} แจ้งเตือนใหม่</span></>
                  )}
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {isHrOrAbove && (
                <Link
                  href="/dashboard/approvals/leaves"
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition"
                >
                  <ClipboardCheck size={15} />
                  ดูรายการอนุมัติ
                </Link>
              )}
              <Link
                href="/dashboard/leaves/new"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-background border border-border text-foreground text-[13px] font-medium hover:bg-muted transition"
              >
                <CalendarDays size={15} />
                ยื่นใบลา
              </Link>
            </div>
          </div>

          {/* Leave balance summary card */}
          {leaveBalances.length > 0 && (
            <div className="hidden sm:flex shrink-0 w-48 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-4 flex-col gap-2 shadow-lg shadow-indigo-900/20">
              <div className="text-[11px] font-medium text-indigo-200">วันลาคงเหลือ</div>
              {leaveBalances.slice(0, 3).map((b) => (
                <div key={b.leaveType} className="flex justify-between items-baseline">
                  <span className="text-[11px] text-indigo-200 truncate max-w-[80px]">{b.leaveType}</span>
                  <span className="text-[16px] font-bold">
                    {b.remainingDays}<span className="text-[11px] font-normal text-indigo-300">/{b.totalDays}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isHrOrAbove && (
          <StatCard
            label="พนักงานทั้งหมด"
            value={stats.totalEmployees.toString()}
            icon={<Users className="h-5 w-5" />}
            tone="slate"
          />
        )}
        <StatCard
          label={isHrOrAbove ? "คำขอลารออนุมัติ" : "คำขอลาของฉัน"}
          value={isHrOrAbove ? stats.pendingLeaves.toString() : stats.myPendingLeaves.toString()}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="indigo"
        />
        <StatCard
          label={isHrOrAbove ? "คำขอเดินทางรออนุมัติ" : "คำขอเดินทางของฉัน"}
          value={isHrOrAbove ? stats.pendingTravel.toString() : stats.myPendingTravel.toString()}
          icon={<Plane className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="แจ้งเตือนใหม่"
          value={stats.unreadNotifications.toString()}
          icon={<Bell className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-[14px]">กิจกรรมล่าสุด</h2>
            <Link href="/dashboard/notifications" className="text-[12px] text-primary hover:underline inline-flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y">
            {recentActivity.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีกิจกรรม</p>
            )}
            {recentActivity.map((act) => {
              const st = statusLabels[act.status] ?? { label: act.status, variant: "outline" as const };
              return (
                <div key={`${act.type}-${act.id}`} className="flex items-center gap-3 py-2.5">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-muted grid place-items-center text-muted-foreground">
                    {act.type === "leave" ? <CalendarDays className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{act.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(act.date).toLocaleDateString("th-TH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Badge variant={st.variant} className="text-xs shrink-0">{st.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leave Balances */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground text-[14px]">วันลาของฉัน</h2>
            <Link href="/dashboard/leaves" className="text-[12px] text-primary hover:underline inline-flex items-center gap-1">
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {leaveBalances.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลวันลา</p>
          )}
          <div className="space-y-4">
            {leaveBalances.map((b) => {
              const pct = b.totalDays > 0 ? (b.usedDays / b.totalDays) * 100 : 0;
              return (
                <div key={b.leaveType}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{b.leaveType}</span>
                    <span className="font-medium">{b.remainingDays}/{b.totalDays} วัน</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, tone = "slate" }: { label: string; value: string; icon: React.ReactNode; tone?: "slate" | "indigo" | "emerald" | "amber" }) {
  const tones = {
    slate: "text-foreground",
    indigo: "text-indigo-600 dark:text-indigo-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-muted-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <div className={`text-[26px] font-bold tracking-tight ${tones[tone]}`}>{value}</div>
    </div>
  );
}
