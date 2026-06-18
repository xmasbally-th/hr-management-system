import { Suspense } from "react";
import TrainingsLoading from "./loading";
import { getMyTrainings } from "@/lib/actions/training-actions";
import { getTrainingTypeLabel } from "@/lib/training-types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";

export const metadata = { title: "ประวัติการอบรม" };

interface TrainingsPageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default function TrainingsPage({ searchParams }: TrainingsPageProps) {
  return (
    <Suspense fallback={<TrainingsLoading />}>
      <TrainingsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TrainingsContent({ searchParams }: TrainingsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";

  const result = await getMyTrainings({ page, search });

  // Calculate totals for summary
  const totalHours = result.data.reduce((sum, t) => sum + ((t.total_hours as number) ?? 0), 0);
  const totalCost = result.data.reduce((sum, t) => sum + ((t.total_cost as number) ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ประวัติการอบรม</h1>
        <p className="text-muted-foreground">ประวัติการเข้าร่วมอบรม สัมมนา และการพัฒนาตนเอง</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">จำนวนหลักสูตร</p>
          <p className="text-2xl font-bold">{result.totalCount}</p>
          <p className="text-xs text-muted-foreground">หลักสูตรทั้งหมด</p>
        </div>
        {totalHours > 0 && (
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">ชั่วโมงอบรม</p>
            <p className="text-2xl font-bold">{totalHours}</p>
            <p className="text-xs text-muted-foreground">ชั่วโมง (หน้านี้)</p>
          </div>
        )}
        {totalCost > 0 && (
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">ค่าใช้จ่าย</p>
            <p className="text-2xl font-bold">{totalCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">บาท (หน้านี้)</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหาหลักสูตร/สถานที่..." className="sm:w-64" />
        </Suspense>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>หลักสูตร</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>ชั่วโมง</TableHead>
              <TableHead>ค่าใช้จ่าย</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((t) => (
              <TableRow key={t.id as string}>
                <TableCell className="font-medium">{t.course_name as string}</TableCell>
                <TableCell>
                  <Badge variant="outline">{getTrainingTypeLabel(t.training_type as string)}</Badge>
                </TableCell>
                <TableCell>{(t.location as string) || "-"}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {t.start_date as string} ~ {t.end_date as string}
                </TableCell>
                <TableCell>{(t.total_hours as number) ?? "-"}</TableCell>
                <TableCell>
                  {(t.total_cost as number) ? `${(t.total_cost as number).toLocaleString()} ฿` : "-"}
                </TableCell>
              </TableRow>
            ))}
            {result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {search ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติการอบรม"}
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
