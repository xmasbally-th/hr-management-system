import Link from "next/link";
import { Suspense } from "react";
import { getMyTravelRequests } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";

export const metadata = { title: "ประวัติการเดินทาง" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
};

const travelTypeMap: Record<string, string> = {
  training: "อบรม/สัมมนา",
  supervision: "นิเทศ",
  official_contact: "ติดต่อราชการ",
};

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รออนุมัติ" },
  { value: "approved", label: "อนุมัติ" },
  { value: "completed", label: "เสร็จสิ้น" },
];

interface TravelExpense {
  id: string;
  expense_category: string;
  estimated_amount: number;
  actual_amount: number | null;
}

interface TravelPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function TravelPage({ searchParams }: TravelPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";

  const result = await getMyTravelRequests({ page, search, status });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ประวัติการเดินทาง</h1>
          <p className="text-muted-foreground">ดูประวัติและยื่นคำขอเดินทางราชการ</p>
        </div>
        <Link href="/dashboard/travel/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            ยื่นคำขอเดินทาง
          </Button>
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหาเรื่อง/สถานที่..." className="sm:w-64" />
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
              <TableHead>เรื่อง</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>งบประมาณ</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((req) => {
              const s = statusMap[req.status as string] ?? { label: req.status as string, variant: "outline" as const };
              const expenses = ((req.expenses ?? []) as TravelExpense[]);
              const totalEstimated = expenses.reduce((sum, e) => sum + e.estimated_amount, 0);
              const totalActual = expenses.reduce((sum, e) => sum + (e.actual_amount ?? 0), 0);

              return (
                <TableRow key={req.id as string}>
                  <TableCell>
                    <Badge variant="outline">{travelTypeMap[req.travel_type as string] ?? (req.travel_type as string)}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{req.title as string}</TableCell>
                  <TableCell>{req.location as string}</TableCell>
                  <TableCell className="text-sm">
                    {req.start_date as string} ~ {req.end_date as string}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>ประมาณ: {totalEstimated.toLocaleString()} ฿</div>
                    {totalActual > 0 && (
                      <div className="text-green-600">จริง: {totalActual.toLocaleString()} ฿</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search || status !== "all" ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติการเดินทาง"}
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
