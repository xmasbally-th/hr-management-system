import { Suspense } from "react";
import { getAllLeaveRequests } from "@/lib/actions/leave-actions";
import { HrLeavesClient } from "./hr-leaves-client";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusStatStrip } from "@/components/status-stat-strip";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "จัดการการลา (HR)" };

interface HrLeavesPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

async function getStatusCounts() {
  const supabase = await createClient();
  const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);
  return {
    total: totalRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    rejected: rejectedRes.count ?? 0,
  };
}

export default async function HrLeavesPage({ searchParams }: HrLeavesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";

  const [result, counts] = await Promise.all([
    getAllLeaveRequests({ page, pageSize: 15, search, status }),
    getStatusCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการการลา</h1>
        <p className="text-muted-foreground">ตรวจสอบและอนุมัติคำขอลาของพนักงานทั้งหมด</p>
      </div>

      {/* Status counter strip — clickable filters */}
      <Suspense>
        <StatusStatStrip
          paramName="status"
          options={[
            { value: "all", label: "ทั้งหมด", count: counts.total, tone: "slate" },
            { value: "pending", label: "รออนุมัติ", count: counts.pending, tone: "amber" },
            { value: "approved", label: "อนุมัติแล้ว", count: counts.approved, tone: "sky" },
            { value: "rejected", label: "ไม่อนุมัติ", count: counts.rejected, tone: "rose" },
          ]}
        />
      </Suspense>

      {/* Search */}
      <Suspense>
        <SearchInput placeholder="ค้นหาชื่อพนักงาน..." className="sm:w-64" />
      </Suspense>

      <HrLeavesClient requests={result.data} />

      <Suspense>
        <PaginationControls
          currentPage={result.page}
          totalCount={result.totalCount}
          pageSize={result.pageSize}
        />
      </Suspense>
    </div>
  );
}
