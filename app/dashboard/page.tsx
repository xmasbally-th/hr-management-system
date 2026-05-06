import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats, getLeaveBalanceSummary, getRecentActivity } from "@/lib/actions/report-actions";
import { DashboardClient } from "./dashboard-client";

export const metadata: Metadata = { title: "หน้าหลัก" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "ผู้ใช้งาน";

  const [stats, leaveBalances, recentActivity] = await Promise.all([
    getDashboardStats(),
    getLeaveBalanceSummary(),
    getRecentActivity(),
  ]);

  return (
    <DashboardClient
      userName={userName}
      stats={stats}
      leaveBalances={leaveBalances}
      recentActivity={recentActivity}
    />
  );
}
