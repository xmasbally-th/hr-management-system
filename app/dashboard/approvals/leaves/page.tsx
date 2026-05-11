import { Suspense } from "react";
import { getAllLeaveRequests } from "@/lib/actions/leave-actions";
import { HrLeavesClient } from "../../hr/leaves/hr-leaves-client";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";

export const metadata = { title: "อนุมัติการลา" };

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รออนุมัติ" },
  { value: "approved", label: "อนุมัติแล้ว" },
  { value: "rejected", label: "ไม่อนุมัติ" },
];

interface Props {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function ApproveLeavesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";

  const result = await getAllLeaveRequests({ page, pageSize: 15, search, status });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">อนุมัติการลา</h1>
        <p className="text-muted-foreground">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอลาของพนักงาน</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหา..." className="sm:w-64" />
        </Suspense>
        <Suspense>
          <StatusFilter options={statusOptions} paramName="status" />
        </Suspense>
      </div>

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
