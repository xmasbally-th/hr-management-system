import { Suspense } from "react";
import { getAllTravelRequests } from "@/lib/actions/travel-actions";
import { HrTravelClient } from "./hr-travel-client";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusStatStrip } from "@/components/status-stat-strip";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "จัดการเดินทางราชการ (HR)" };

interface HrTravelPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

async function getStatusCounts() {
  const supabase = await createClient();
  const [pendingRes, approvedRes, completedRes, totalRes] = await Promise.all([
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }),
  ]);
  return {
    total: totalRes.count ?? 0,
    pending: pendingRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    completed: completedRes.count ?? 0,
  };
}

export default async function HrTravelPage({ searchParams }: HrTravelPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";

  const [result, counts] = await Promise.all([
    getAllTravelRequests({ page, pageSize: 15, search, status }),
    getStatusCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการเดินทางราชการ</h1>
        <p className="text-muted-foreground">ตรวจสอบ อนุมัติ และบันทึกค่าใช้จ่ายจริง</p>
      </div>

      {/* Status counter strip — clickable filters */}
      <Suspense>
        <StatusStatStrip
          paramName="status"
          options={[
            { value: "all", label: "ทั้งหมด", count: counts.total, tone: "slate" },
            { value: "pending", label: "รออนุมัติ", count: counts.pending, tone: "amber" },
            { value: "approved", label: "อนุมัติแล้ว", count: counts.approved, tone: "sky" },
            { value: "completed", label: "เสร็จสิ้น", count: counts.completed, tone: "emerald" },
          ]}
        />
      </Suspense>

      {/* Search */}
      <Suspense>
        <SearchInput placeholder="ค้นหาเรื่อง/สถานที่..." className="sm:w-64" />
      </Suspense>

      <HrTravelClient requests={result.data} />

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
