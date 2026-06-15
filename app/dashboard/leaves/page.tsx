import Link from "next/link";
import { Suspense } from "react";
import {
  getMyLeaveRequests,
  getMyLeaveBalances,
  getMyLeaveCountsByType,
} from "@/lib/actions/leave-actions";
import {
  currentFiscalYear,
  currentCycle,
  fiscalYearRange,
  performanceCycleRange,
  formatThai,
} from "@/lib/date-ranges";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Info, Thermometer, Briefcase, Palmtree, Baby, CalendarDays, AlertCircle, ArrowRight } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";
import { LeavePeriodFilter } from "./leave-period-filter";

export const metadata = { title: "การลางาน" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รอตรวจสอบ", variant: "secondary" },
  awaiting_chair: { label: "รอประธานสาขา", variant: "secondary" },
  awaiting_director: { label: "รอผอ.สำนักงานลงนาม", variant: "secondary" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  awaiting_university: { label: "รออธิการบดี", variant: "secondary" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

const statusOptions = [
  { value: "all", label: "ทั้งหมด" },
  { value: "pending", label: "รออนุมัติ" },
  { value: "approved", label: "อนุมัติ" },
  { value: "rejected", label: "ไม่อนุมัติ" },
];

/** Icon per leave-type code (matches the summary cards in the design). */
const leaveTypeIcon: Record<string, typeof Thermometer> = {
  SICK: Thermometer,
  PERSONAL: Briefcase,
  VACATION: Palmtree,
  MATERNITY: Baby,
};

interface LeavesPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string; fy?: string; round?: string }>;
}

export default async function LeavesPage({ searchParams }: LeavesPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const status = params.status ?? "all";
  const fy = Number(params.fy) || currentFiscalYear();
  const round = (Number(params.round) || currentCycle().half) as 1 | 2;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isHrAdmin = profile?.role === "hr" || profile?.role === "admin";

  const [result, balances, counts] = await Promise.all([
    getMyLeaveRequests({ page, search, status, fy, round }),
    getMyLeaveBalances(fy),
    getMyLeaveCountsByType(fy),
  ]);

  const range = performanceCycleRange(fy, round);
  const periodLabel = `ข้อมูล${fiscalYearRange(fy).label} (${formatThai(range.start)} – ${formatThai(range.end)})`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">การลางาน</h1>
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Suspense>
            <LeavePeriodFilter />
          </Suspense>
          <Link href="/dashboard/leaves/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              สร้างใบลา
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left column: summary cards + criteria */}
        <div className="space-y-4">
          {(balances ?? []).length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" />
                ยังไม่ได้เริ่มต้นสิทธิ์วันลา
              </div>
              <p className="text-xs leading-relaxed">
                ยังไม่มีข้อมูลสิทธิ์วันลาของคุณในปีงบประมาณนี้
                {isHrAdmin
                  ? " — ใช้หน้า “จัดการวันลา” เพื่อเริ่มต้นสิทธิ์ให้พนักงานทุกคน"
                  : " — กรุณาติดต่อฝ่ายทรัพยากรบุคคล"}
              </p>
              {isHrAdmin && (
                <Link
                  href="/dashboard/hr/leave-balances"
                  className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                >
                  ไปยังหน้าจัดการวันลา
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
          {(balances ?? []).map((b) => {
            const lt = b.leave_type as { name: string; code: string | null } | null;
            const Icon = leaveTypeIcon[lt?.code ?? ""] ?? CalendarDays;
            const count = counts[b.leave_type_id as string] ?? 0;
            return (
              <div key={b.id} className="border rounded-lg p-4 bg-card flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{lt?.name ?? "ไม่ทราบประเภท"}</p>
                    <Badge variant="secondary" className="shrink-0">สิทธิ์ {b.total_days} วัน</Badge>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="text-2xl font-bold">{b.used_days}</span> วัน
                    <span className="text-muted-foreground"> | {count} ครั้ง</span>
                  </p>
                </div>
              </div>
            );
          })}

          {/* Leave criteria (static reference) */}
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900 space-y-2 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="flex items-center gap-2 font-semibold">
              <Info className="h-4 w-4" />
              เกณฑ์การลาราชการ
            </div>
            <ul className="space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>ลาป่วย: ครั้งละไม่เกิน 30 วัน (ลา 2 วันขึ้นไปต้องมีใบรับรองแพทย์)</li>
              <li>ลากิจส่วนตัว: ครั้งละไม่เกิน 10 วัน และรวมปีละไม่เกิน 10 วันทำการ</li>
              <li>ลาคลอดบุตร: ไม่เกิน 90 วัน (ได้รับเงินเดือนระหว่างลา)</li>
              <li>ลาช่วยเหลือภริยาคลอด: ครั้งหนึ่งไม่เกิน 15 วันทำการ</li>
              <li>ลาอุปสมบท: ไม่เกิน 120 วัน (ต้องรับราชการไม่น้อยกว่า 1 ปี)</li>
            </ul>
          </div>
        </div>

        {/* Right column: history */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">ประวัติการลาล่าสุด</h2>

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
                  <TableHead>วันที่ส่ง</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>ช่วงเวลา</TableHead>
                  <TableHead>จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.data.map((req) => {
                  const s = statusMap[req.status as string] ?? { label: req.status as string, variant: "outline" as const };
                  const days = (req.working_days as number | null) ?? (req.total_days as number);
                  return (
                    <TableRow key={req.id as string} className="hover:bg-muted/30">
                      <TableCell className="text-muted-foreground">
                        {new Date(req.created_at as string).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {(req.leave_type as { name: string } | null)?.name ?? "-"}
                      </TableCell>
                      <TableCell>
                        {formatThai(req.start_date as string)} – {formatThai(req.end_date as string)}
                      </TableCell>
                      <TableCell>{days} วัน</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/leaves/${req.id as string}`} className="text-sm text-primary hover:underline">
                          ดูรายละเอียด
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {result.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {search || status !== "all" ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีประวัติการลาในรอบนี้"}
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
      </div>
    </div>
  );
}
