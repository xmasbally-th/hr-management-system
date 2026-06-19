import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardStats,
  getLeaveBalanceSummary,
  getRecentActivity,
  getManagerDashboardData,
  getHrDashboardData,
  getAdminDashboardData,
} from "@/lib/actions/report-actions";
import { getMyAttendance } from "@/lib/actions/attendance-actions";
import { EmployeeDashboard } from "./_components/employee-dashboard";
import { ManagerDashboard } from "./_components/manager-dashboard";
import { HrDashboard } from "./_components/hr-dashboard";
import { AdminDashboard } from "./_components/admin-dashboard";

export const metadata: Metadata = { title: "หน้าหลัก" };

/**
 * Role-aware dashboard router.
 *
 * Reads the current user's role from `profiles` and dispatches to one of
 * four dedicated dashboard views (Employee / Manager / HR / Admin). Each
 * view fetches only the data it needs to keep the page fast.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "ผู้ใช้งาน";

  const stats = await getDashboardStats();
  const role = stats.role;

  if (role === "admin") {
    const data = await getAdminDashboardData();
    return <AdminDashboard data={data} />;
  }

  if (role === "hr") {
    const data = await getHrDashboardData();
    return <HrDashboard data={data} />;
  }

  if (role === "manager") {
    const data = await getManagerDashboardData();
    return <ManagerDashboard userName={userName} data={data} />;
  }

  // Default: employee view
  const [leaveBalances, recentActivity, myAttendance] = await Promise.all([
    getLeaveBalanceSummary(),
    getRecentActivity(),
    // Don't break the dashboard if the attendance tables aren't migrated yet.
    getMyAttendance().catch(() => []),
  ]);

  // Widget shows the latest MONTHLY round (annual uses a different shape).
  const latest = (myAttendance as MyAttendanceEntry[]).find(
    (x) => x.period?.period_type === "monthly" && x.period.month != null,
  );
  const latestAttendance = latest?.period?.month != null
    ? {
        month: latest.period.month ?? 0,
        buddhist_year: latest.period.buddhist_year,
        working_days: latest.period.working_days ?? 0,
        work_days: latest.work_days,
        travel_days: latest.travel_days,
        leave_total:
          latest.leave_vacation +
          latest.leave_personal +
          latest.leave_sick +
          latest.leave_study +
          latest.leave_maternity +
          latest.leave_ordination,
        late_online_days: latest.late_online_days,
        missing_checkout_count: latest.missing_checkout_count,
        total_days: latest.total_days,
      }
    : null;

  return (
    <EmployeeDashboard
      userName={userName}
      myPendingLeaves={stats.myPendingLeaves}
      myPendingTravel={stats.myPendingTravel}
      leaveBalances={leaveBalances}
      recentActivity={recentActivity}
      latestAttendance={latestAttendance}
    />
  );
}

interface MyAttendanceEntry {
  work_days: number;
  travel_days: number;
  leave_vacation: number;
  leave_personal: number;
  leave_sick: number;
  leave_study: number;
  leave_maternity: number;
  leave_ordination: number;
  total_days: number;
  late_online_days: number;
  missing_checkout_count: number;
  period: {
    period_type: "monthly" | "annual";
    buddhist_year: number;
    month: number | null;
    working_days: number | null;
  } | null;
}
