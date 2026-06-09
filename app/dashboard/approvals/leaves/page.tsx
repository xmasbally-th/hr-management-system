import Link from "next/link";
import { Suspense } from "react";
import { getAllLeaveRequests } from "@/lib/actions/leave-actions";
import { getEffectiveDeanSignerIds } from "@/lib/actions/approver-actions";
import { createClient } from "@/lib/supabase/server";
import { HrLeavesClient } from "../../hr/leaves/hr-leaves-client";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";
import { PenLine, ArrowRight } from "lucide-react";

export const metadata = { title: "อนุมัติการลา" };

/** Stage a designated approver signs, keyed by approver role. */
const ROLE_STAGE: Record<string, { status: string; label: string }> = {
  chair: { status: "awaiting_chair", label: "ประธานสาขาวิชา" },
  director: { status: "awaiting_director", label: "ผู้อำนวยการ" },
  dean: { status: "awaiting_dean", label: "คณบดี" },
};

/** Resolve the stages the current viewer can sign + how many requests wait. */
async function resolveMyQueue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const roles = new Set<string>();
  const { data: assigned } = await supabase
    .from("workflow_approvers").select("approver_role").eq("user_id", user.id);
  for (const r of assigned ?? []) roles.add(r.approver_role as string);

  // Dean acting-delegate (รักษาราชการแทน) counts as dean today.
  const deanToday = await getEffectiveDeanSignerIds(new Date().toISOString().slice(0, 10));
  if (deanToday.includes(user.id)) roles.add("dean");

  const stages = [...roles].map((r) => ROLE_STAGE[r]).filter(Boolean);
  if (stages.length === 0) return null;

  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .in("status", stages.map((s) => s.status) as ("awaiting_chair" | "awaiting_director" | "awaiting_dean")[]);

  return { stages, count: count ?? 0 };
}

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

  const [result, myQueue] = await Promise.all([
    getAllLeaveRequests({ page, pageSize: 15, search, status }),
    resolveMyQueue(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">อนุมัติการลา</h1>
          <p className="text-muted-foreground">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอลาของพนักงาน</p>
        </div>
        <Link
          href="/dashboard/leaves/calendar"
          className="inline-flex items-center gap-1.5 text-sm text-sky-700 hover:text-sky-900 underline-offset-2 hover:underline"
        >
          ดูปฏิทินการลา →
        </Link>
      </div>

      {myQueue && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 flex items-center justify-between gap-4 flex-wrap dark:border-violet-900/40 dark:bg-violet-950/20">
          <div className="flex items-center gap-2 text-sm text-violet-900 dark:text-violet-200">
            <PenLine className="h-4 w-4 shrink-0" />
            <span>
              คุณเป็นผู้ลงนามระดับ{" "}
              <b>{myQueue.stages.map((s) => s.label).join(" / ")}</b> —{" "}
              {myQueue.count > 0
                ? `มี ${myQueue.count} คำขอรอการลงนามของคุณ`
                : "ไม่มีคำขอรอการลงนามของคุณ"}
            </span>
          </div>
          {myQueue.count > 0 && (
            <Link
              href={`/dashboard/approvals/leaves?status=${myQueue.stages[0].status}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:text-violet-900 underline-offset-2 hover:underline"
            >
              ดูเฉพาะที่รอฉัน <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

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
