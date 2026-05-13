import Link from "next/link";
import {
  Shield,
  FileText,
  ScanLine,
  Plus,
  Users,
  Printer,
  Upload,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { StatCard, Panel } from "./dashboard-primitives";
import type { HrDashboardData } from "@/lib/actions/report-actions";

interface Props {
  data: HrDashboardData;
}

const statusBadgeTone: Record<string, { label: string; cls: string }> = {
  pending: { label: "รออนุมัติ", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  approved: { label: "อนุมัติแล้ว", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
  completed: { label: "เสร็จสิ้น", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "ไม่อนุมัติ", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  cancelled: { label: "ยกเลิก", cls: "bg-slate-50 text-slate-600 ring-slate-200" },
};

/**
 * HR dashboard view — emerald-toned.
 * Document pipeline, Paper Channel tasks, department breakdown.
 */
export function HrDashboard({ data }: Props) {
  const totalPending = data.pendingLeavesCount + data.pendingTravelCount;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-card">
        <div className="absolute inset-0 dotted-bg opacity-60"></div>
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl"></div>
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              <Shield className="h-3 w-3" />
              <span>ภาพรวมองค์กร · HR Console</span>
            </div>
            <h1 className="mt-3 text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-tight">
              ศูนย์จัดการบุคลากร
            </h1>
            <p className="mt-1.5 text-[14px] text-slate-600 max-w-lg">
              วันนี้มี <span className="font-semibold text-slate-900">{totalPending} เอกสาร</span> รอดำเนินการ ·{" "}
              <span className="font-semibold text-slate-900">{data.paperPending} ฉบับ</span> รอบันทึก Paper Channel
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/approvals/leaves"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 text-white text-[13px] font-semibold hover:bg-slate-800 transition"
              >
                <FileText className="h-3.5 w-3.5" /> เปิดศูนย์เอกสาร
              </Link>
              <Link
                href="/dashboard/hr/paper-channel"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-medium hover:bg-emerald-100 transition"
              >
                <ScanLine className="h-3.5 w-3.5" /> Paper Channel
              </Link>
              <Link
                href="/dashboard/hr/users/add"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-card border border-slate-200 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition"
              >
                <Plus className="h-3.5 w-3.5" /> เพิ่มพนักงาน
              </Link>
            </div>
          </div>

          <div className="shrink-0 grid grid-cols-2 gap-2 w-56">
            <div className="rounded-xl bg-emerald-600 text-white p-3">
              <div className="text-[10px] text-emerald-200 font-medium uppercase tracking-wider">วันนี้</div>
              <div className="text-[26px] font-bold leading-none font-mono mt-1">{totalPending}</div>
              <div className="text-[10px] text-emerald-200 mt-1">รอดำเนินการ</div>
            </div>
            <div className="rounded-xl bg-slate-900 text-white p-3">
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">ทั้งหมด</div>
              <div className="text-[26px] font-bold leading-none font-mono mt-1">{data.totalEmployees}</div>
              <div className="text-[10px] text-slate-400 mt-1">พนักงาน</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats — HR focused */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="พนักงานทั้งหมด" value={data.totalEmployees} tone="slate" icon={Users} />
        <StatCard
          label="คำขอรออนุมัติ"
          value={totalPending}
          hint={`ลา ${data.pendingLeavesCount} · เดินทาง ${data.pendingTravelCount}`}
          tone="indigo"
          icon={FileText}
        />
        <StatCard label="อนุมัติวันนี้" value={data.approvedToday} hint="รวมใบลา + เดินทาง" tone="sky" icon={Printer} />
        <StatCard
          label="Paper Channel"
          value={data.paperPending}
          hint="รอบันทึกตัวจริง"
          tone="amber"
          icon={ScanLine}
        />
        <StatCard
          label="รอสแกนอัปโหลด"
          value={data.scannedPending}
          hint="เซ็นแล้ว รอสแกน"
          tone="emerald"
          icon={CheckCheck}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Document pipeline */}
        <Panel
          title="สถานะเอกสาร"
          sub="Document Pipeline · ทั้งหมด"
          className="lg:col-span-2"
          action={
            <Link
              href="/dashboard/hr/leaves"
              className="text-[12px] text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              เปิดทั้งหมด <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {/* Pipeline visualization */}
          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: "รออนุมัติ", count: data.pipeline.pending, tone: "amber" },
              { label: "อนุมัติแล้ว", count: data.pipeline.approved, tone: "sky" },
              { label: "เสร็จสิ้น", count: data.pipeline.completed, tone: "emerald" },
              { label: "ไม่อนุมัติ", count: data.pipeline.rejected, tone: "rose" },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-lg bg-${s.tone}-50 border border-${s.tone}-100 p-3`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono font-semibold text-${s.tone}-700`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full bg-${s.tone}-500`}></span>
                  <span className="truncate">{s.label}</span>
                </div>
                <div
                  className={`text-[24px] font-bold tracking-tight text-${s.tone}-900 mt-1 font-mono`}
                >
                  {s.count}
                </div>
              </div>
            ))}
          </div>

          {/* Recent docs */}
          {data.recentDocs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีเอกสาร</p>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {data.recentDocs.map((d) => {
                const tone = statusBadgeTone[d.status] ?? statusBadgeTone.pending;
                const href = d.type === "leave" ? `/dashboard/leaves/${d.id}` : `/dashboard/travel/${d.id}`;
                return (
                  <li key={`${d.type}-${d.id}`} className="hover:bg-slate-50/60 rounded-md">
                    <Link href={href} className="flex items-center gap-3 py-3 px-1">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center text-white text-[11px] font-semibold shrink-0">
                        {d.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-slate-500">
                            {d.type === "leave" ? "LV" : "TR"}-{d.id.slice(0, 8)}
                          </span>
                          {d.channel === "paper" && (
                            <span className="text-[9px] font-mono uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              Paper
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] font-medium text-slate-900 truncate">
                          {d.name} · <span className="text-slate-500 font-normal">{d.dept}</span>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 shrink-0 ${tone.cls}`}
                      >
                        {tone.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Paper Channel tasks */}
        <Panel
          title="Paper Channel"
          sub="งานเอกสารกระดาษ"
          action={
            data.paperPending > 0 ? (
              <span className="text-[10px] font-mono uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {data.paperPending} รอ
              </span>
            ) : null
          }
        >
          <ul className="space-y-2.5">
            {[
              {
                step: "พิมพ์ออก",
                Ico: Printer,
                count: Math.max(data.paperPending - data.scannedPending, 0),
                tone: "sky",
                desc: "รอส่งให้ผู้บริหารเซ็น",
              },
              {
                step: "สแกน + อัปโหลด",
                Ico: Upload,
                count: data.scannedPending,
                tone: "indigo",
                desc: "เซ็นแล้ว รอสแกน",
              },
              {
                step: "ส่งตัวจริง",
                Ico: FileText,
                count: 0,
                tone: "emerald",
                desc: "ทั้งหมดส่งแล้ว",
              },
            ].map((t) => (
              <Link
                key={t.step}
                href="/dashboard/hr/paper-channel"
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 text-left transition"
              >
                <div
                  className={`w-9 h-9 rounded-lg bg-${t.tone}-100 text-${t.tone}-700 grid place-items-center shrink-0`}
                >
                  <t.Ico className="h-[15px] w-[15px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-slate-900">{t.step}</div>
                  <div className="text-[11px] text-slate-500 truncate">{t.desc}</div>
                </div>
                <span
                  className={`shrink-0 min-w-[28px] h-7 px-2 rounded-full grid place-items-center text-[12px] font-mono font-bold ${
                    t.count > 0
                      ? `bg-${t.tone}-600 text-white`
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {t.count}
                </span>
              </Link>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Department breakdown */}
      {data.departments.length > 0 && (
        <Panel title="ภาพรวมตามแผนก" sub="Department Breakdown">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.departments.map((d) => (
              <div key={d.name} className="p-3 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[13px] font-semibold text-slate-900 truncate">{d.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono shrink-0">{d.total} คน</div>
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${
                        data.totalEmployees > 0
                          ? Math.min((d.total / data.totalEmployees) * 100 * 3, 100)
                          : 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
