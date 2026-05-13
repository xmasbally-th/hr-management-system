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
  const [leaveBalances, recentActivity] = await Promise.all([
    getLeaveBalanceSummary(),
    getRecentActivity(),
  ]);

  return (
    <EmployeeDashboard
      userName={userName}
      myPendingLeaves={stats.myPendingLeaves}
      myPendingTravel={stats.myPendingTravel}
      leaveBalances={leaveBalances}
      recentActivity={recentActivity}
    />
  );
}
