import Link from "next/link";
import { Suspense } from "react";
import { getMyLeaveRequests, getMyLeaveBalances } from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";

export const metadata = { title: "ประวัติการลา" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รออนุมัติ" },
  { value: "approved", label: "อนุมัติ" },
  { value: "rejected", label: "ไม่อนุมัติ" },
];

interface LeavesPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function LeavesPage({ searchParams }: LeavesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";

  const [result, balances] = await Promise.all([
    getMyLeaveRequests({ page, search, status }),
    getMyLeaveBalances(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ประวัติการลา</h1>
          <p className="text-muted-foreground">ดูประวัติและยื่นคำขอลาใหม่</p>
        </div>
        <Link href="/dashboard/leaves/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            ยื่นคำขอลา
          </Button>
        </Link>
      </div>

      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.id} className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground">{(b.leave_type as { name: string } | null)?.name ?? "ไม่ทราบประเภท"}</p>
              <p className="text-2xl font-bold">{b.remaining_days}</p>
              <p className="text-xs text-muted-foreground">คงเหลือจาก {b.total_days} วัน</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหาเหตุผล..." className="sm:w-64" />
        </Suspense>
        <Suspense>
          <StatusFilter options={statusOptions} paramName="status" />
        </Suspense>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>วันที่เริ่ม</TableHead>
              <TableHead>วันที่สิ้นสุด</TableHead>
              <TableHead>จำนวนวัน</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>วันที่ยื่น</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((req) => {
              const s = statusMap[req.status as string] ?? { label: req.status as string, variant: "outline" as const };
              return (
                <TableRow key={req.id as string}>
                  <TableCell className="font-medium">
                    {(req.leave_type as { name: string } | null)?.name ?? "-"}
                  </TableCell>
                  <TableCell>{req.start_date as string}</TableCell>
                  <TableCell>{req.end_date as string}</TableCell>
                  <TableCell>{req.total_days as number}</TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(req.created_at as string).toLocaleDateString("th-TH")}
                  </TableCell>
                </TableRow>
              );
            })}
            {result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search || status !== "all" ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติการลา"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
