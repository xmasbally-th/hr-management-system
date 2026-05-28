import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeaveTypes, getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { getLeavePolicy, type LeavePolicy } from "@/lib/actions/settings-actions";
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

  // Fetch each separately so the route logs name which call failed when
  // anything throws. This is intentionally verbose during the debug phase
  // for the production "Server Components render" error; can be collapsed
  // back into Promise.all once the root cause is identified.
  let leaveTypes: Awaited<ReturnType<typeof getLeaveTypes>>;
  let employees: Awaited<ReturnType<typeof getEmployeesForSelection>>;
  let policy: LeavePolicy;
  try {
    leaveTypes = await getLeaveTypes();
  } catch (err) {
    console.error("[paper-leave] getLeaveTypes failed:", err);
    throw err;
  }
  try {
    employees = await getEmployeesForSelection();
  } catch (err) {
    console.error("[paper-leave] getEmployeesForSelection failed:", err);
    throw err;
  }
  try {
    policy = await getLeavePolicy();
  } catch (err) {
    console.error("[paper-leave] getLeavePolicy failed, using defaults:", err);
    policy = DEFAULT_POLICY;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บันทึกใบลาแทนพนักงาน</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลจากใบลากระดาษที่พนักงานยื่น ระบบจะบันทึกเป็นช่องทาง &quot;กระดาษ&quot; โดยอัตโนมัติ
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <PaperLeaveForm leaveTypes={leaveTypes} employees={employees} policy={policy} />
      </div>
    </div>
  );
}
