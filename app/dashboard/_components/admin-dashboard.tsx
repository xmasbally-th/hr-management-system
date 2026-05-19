import Link from "next/link";
import { Users, Database, Activity, AlertCircle, ArrowRight } from "lucide-react";
import { StatCard, Panel } from "./dashboard-primitives";
import { CorrectionsPanel } from "./corrections-panel";
import type { AdminDashboardData } from "@/lib/actions/report-actions";

interface Props {
  data: AdminDashboardData;
}

const roleLabel: Record<string, string> = {
  employee: "Employee",
  manager: "Manager",
  hr: "HR",
  admin: "Admin",
};

const roleTone: Record<string, string> = {
  employee: "sky",
  manager: "violet",
  hr: "emerald",
  admin: "rose",
};

const actionTone: Record<string, string> = {
  CREATE: "emerald",
  UPDATE: "sky",
  APPROVE: "emerald",
  REJECT: "rose",
  DELETE: "rose",
  ROLE_CHANGED: "rose",
  STATUS_CHANGED: "amber",
};

/**
 * Admin dashboard view — rose/terminal-toned.
 * Service health (placeholder), role distribution, audit log.
 */
export function AdminDashboard({ data }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header — terminal-like */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-slate-950 text-white">
        <div className="absolute inset-0 grid-bg opacity-50"></div>
        <div className="absolute -top-32 -right-20 w-[420px] h-[420px] rounded-full bg-rose-600/10 blur-3xl"></div>
        <div className="relative p-6 sm:p-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-[0.625rem] font-mono uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-400/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                <span>System Administrator</span>
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight font-mono">
                <span className="text-slate-400">$</span> system.status
                <span className="text-rose-400">()</span>
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-xl font-mono">
                All systems <span className="text-emerald-400">operational</span> ·{" "}
                <span className="text-sky-300">{data.totalUsers}</span> users · audit events tracked
              </p>
            </div>
            {/* KPI tiles */}
            <div className="flex items-stretch gap-2">
              {[
                { label: "Users", value: data.totalUsers.toString(), tone: "emerald" },
                { label: "Alerts", value: data.alertsCount.toString(), tone: "rose" },
                { label: "API/24h", value: data.apiCalls24h.toString(), tone: "sky" },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 min-w-[88px]"
                >
                  <div className="text-[0.625rem] uppercase tracking-widest font-mono text-slate-400">
                    {k.label}
                  </div>
                  <div className={`text-base font-bold font-mono mt-0.5 text-${k.tone}-300`}>
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ผู้ใช้งานทั้งหมด" value={data.totalUsers} tone="sky" icon={Users} />
        <StatCard
          label="Audit Events (24h)"
          value={data.apiCalls24h}
          hint="ใน 24 ชม. ที่ผ่านมา"
          tone="violet"
          icon={Database}
        />
        <StatCard
          label="Active Roles"
          value={data.rolesDistribution.filter((r) => r.count > 0).length}
          hint="role ที่ถูกใช้"
          tone="emerald"
          icon={Activity}
        />
        <StatCard label="Alerts" value={data.alertsCount} hint="ไม่มีการแจ้งเตือน" tone="rose" icon={AlertCircle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Audit log preview */}
        <Panel
          title="Audit Log ล่าสุด"
          sub="Recent System Events"
          className="lg:col-span-2"
          action={
            <Link
              href="/dashboard/settings?tab=audit"
              className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              ดูทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {data.recentAuditLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มี audit log</p>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[0.625rem] font-mono uppercase tracking-wider text-slate-500 border-b border-border">
                    <th className="px-5 py-2 font-semibold">Timestamp</th>
                    <th className="px-2 py-2 font-semibold">User</th>
                    <th className="px-2 py-2 font-semibold">Action</th>
                    <th className="px-5 py-2 font-semibold">Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAuditLogs.map((e) => {
                    const tone = actionTone[e.action] ?? "slate";
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-border/70 last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="px-5 py-2.5 font-mono text-slate-600">
                          {new Date(e.timestamp).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 grid place-items-center text-white text-[0.625rem] font-semibold">
                              {e.initials}
                            </span>
                            <span className="text-slate-800 font-medium truncate max-w-[120px]">
                              {e.user}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span
                            className={`font-mono text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded bg-${tone}-50 text-${tone}-700 ring-1 ring-${tone}-200`}
                          >
                            {e.action}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-slate-600 truncate max-w-[160px]">
                          {e.target}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Role distribution */}
        <Panel title="การกระจาย Role" sub="Role Distribution">
          <div className="space-y-3">
            {data.rolesDistribution.map((rr) => {
              const pct = data.totalUsers > 0 ? (rr.count / data.totalUsers) * 100 : 0;
              const tone = roleTone[rr.role] ?? "slate";
              return (
                <div key={rr.role}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">
                      {roleLabel[rr.role] ?? rr.role}
                    </span>
                    <span className="font-mono text-slate-500">
                      {rr.count} · {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-${tone}-500 rounded-full`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-border/70 flex items-center justify-between">
              <span className="text-xs text-slate-500">รวม</span>
              <span className="text-sm font-mono font-bold text-slate-900">
                {data.totalUsers} ผู้ใช้
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Pending correction-request panel — surfaces HR's queue depth */}
      <CorrectionsPanel data={data.pendingCorrections} />
    </div>
  );
}
