import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeaveTypes, getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { getLeavePolicy, getExamDutyPositions, type LeavePolicy } from "@/lib/actions/settings-actions";
import { getExamPeriods } from "@/lib/actions/exam-period-actions";
import { currentFiscalYear } from "@/lib/date-ranges";
import { PaperLeaveForm } from "./paper-leave-form";

export const metadata: Metadata = { title: "บันทึกใบลา (กระดาษ)" };

const DEFAULT_POLICY: LeavePolicy = {
  sick_cert_threshold_working_days: 2,
  personal_advance_notice_days: 3,
};

export default async function PaperLeavePage() {
  // Explicit auth + HR/admin gate up front — matches the other HR pages
  // (e.g. /dashboard/hr/leave-balances). Previously this page relied on
  // getEmployeesForSelection() to throw for non-HR, which surfaces as an
  // opaque "Server Components render" error in production instead of a
  // clean redirect.
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
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    redirect("/dashboard");
  }

  // Fetch in parallel. getLeavePolicy falls back to defaults so a transient
  // system_settings read can't blank the page; other failures bubble up to
  // the route's error.tsx (which exposes the digest for cross-referencing
  // with Vercel runtime logs).
  const curFy = currentFiscalYear();
  const [leaveTypes, employees, policy, examThisFy, examNextFy, dutyPositions] = await Promise.all([
    getLeaveTypes(),
    getEmployeesForSelection(),
    getLeavePolicy().catch((err) => {
      console.error("[paper-leave] getLeavePolicy failed, using defaults:", err);
      return DEFAULT_POLICY;
    }),
    getExamPeriods(curFy).catch(() => []),
    getExamPeriods(curFy + 1).catch(() => []),
    getExamDutyPositions().catch(() => []),
  ]);
  const examPeriods = [...examThisFy, ...examNextFy];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บันทึกใบลาแทนพนักงาน</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลจากใบลากระดาษที่พนักงานยื่น ระบบจะบันทึกเป็นช่องทาง &quot;กระดาษ&quot; โดยอัตโนมัติ
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <PaperLeaveForm
          leaveTypes={leaveTypes}
          employees={employees}
          policy={policy}
          examPeriods={examPeriods}
          dutyPositions={dutyPositions}
        />
      </div>
    </div>
  );
}
