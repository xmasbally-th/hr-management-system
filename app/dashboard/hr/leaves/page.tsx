import { getLeaveTypes, getLeaveRequestsForFiscalYear } from "@/lib/actions/leave-actions";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { createClient } from "@/lib/supabase/server";
import { LeavesDashboardClient } from "./leaves-dashboard-client";

export const metadata = { title: "จัดการข้อมูลการลา (HR)" };

async function getActivePersonnel() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, position_title")
    .eq("status", "approved")
    .order("full_name");
  return data ?? [];
}

export default async function HrLeavesPage() {
  const fy = currentFiscalYear();

  const [leaveTypes, personnel, initialRequests] = await Promise.all([
    getLeaveTypes(),
    getActivePersonnel(),
    getLeaveRequestsForFiscalYear(fy),
  ]);

  return (
    <LeavesDashboardClient
      leaveTypes={(leaveTypes ?? []).map((t) => ({ id: t.id, name: t.name, code: t.code }))}
      personnel={personnel}
      initialRequests={initialRequests}
      fiscalYearOptions={getFiscalYearOptions()}
      currentFiscalYear={fy}
    />
  );
}
