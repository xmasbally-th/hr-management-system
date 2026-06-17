import { Suspense } from "react";
import { getProfiles } from "@/lib/actions/user-actions";
import { getPendingCorrectionCountsByUser } from "@/lib/actions/correction-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserActionsMenu } from "./user-actions-menu";
import { UserRowActions } from "./user-row-actions";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus, Upload, FileEdit } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";
import { StatusStatStrip } from "@/components/status-stat-strip";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "จัดการผู้ใช้งาน",
};

const roleOptions = [
  { value: "all", label: "ทุกสิทธิ์" },
  { value: "admin", label: "Admin" },
  { value: "hr", label: "HR" },
  { value: "manager", label: "Manager" },
  { value: "employee", label: "Employee" },
];

const statusFilterOptions = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "pre_registered", label: "ยังไม่เข้าระบบ" },
  { value: "awaiting_confirmation", label: "รอยืนยันข้อมูล" },
  { value: "awaiting_correction", label: "รอการแก้ไข" },
  { value: "approved", label: "ใช้งานปกติ" },
  { value: "pending", label: "รออนุมัติ (legacy)" },
  { value: "rejected", label: "ระงับ" },
];

import { completionPct } from "@/lib/profile-completion";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    status?: string;
  }>;
}

async function getStatusCounts() {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [totalRes, preRes, awaitConfRes, awaitCorrRes, approvedRes, rejectedRes] = await Promise.all([
    supabase.from("profiles").select("id", head),
    supabase.from("profiles").select("id", head).eq("status", "pre_registered"),
    supabase.from("profiles").select("id", head).eq("status", "awaiting_confirmation"),
    supabase.from("profiles").select("id", head).eq("status", "awaiting_correction"),
    supabase.from("profiles").select("id", head).eq("status", "approved"),
    supabase.from("profiles").select("id", head).eq("status", "rejected"),
  ]);
  return {
    total: totalRes.count ?? 0,
    pre_registered: preRes.count ?? 0,
    awaiting_confirmation: awaitConfRes.count ?? 0,
    awaiting_correction: awaitCorrRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    rejected: rejectedRes.count ?? 0,
  };
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search ?? "";
  const role = params.role ?? "all";
  const status = params.status ?? "all";

  const [result, counts, correctionCounts] = await Promise.all([
    getProfiles({ page, search, role, status }),
    getStatusCounts(),
    getPendingCorrectionCountsByUser().catch((): Record<string, number> => ({})),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการผู้ใช้งาน</h1>
          <p className="text-muted-foreground">
            รายชื่อพนักงาน สถานะ และสิทธิ์การเข้าถึงระบบ
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/hr/users/import"
            className={buttonVariants({ variant: "outline" })}
          >
            <Upload className="mr-2 h-4 w-4" />
            นำเข้าเป็นชุด
          </Link>
          <Link
            href="/dashboard/hr/users/add"
            className={buttonVariants({ variant: "default" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            เพิ่มพนักงาน
          </Link>
        </div>
      </div>

      {/* Status counter strip — clickable filters */}
      <Suspense>
        <StatusStatStrip
          paramName="status"
          options={[
            { value: "all", label: "ทั้งหมด", count: counts.total, tone: "slate" },
            { value: "pre_registered", label: "ยังไม่เข้าระบบ", count: counts.pre_registered, tone: "slate" },
            { value: "awaiting_confirmation", label: "รอยืนยัน", count: counts.awaiting_confirmation, tone: "amber" },
            { value: "awaiting_correction", label: "รอการแก้ไข", count: counts.awaiting_correction, tone: "amber" },
            { value: "approved", label: "ใช้งานปกติ", count: counts.approved, tone: "emerald" },
            { value: "rejected", label: "ระงับ", count: counts.rejected, tone: "rose" },
          ]}
        />
      </Suspense>

      {/* Search + Role + Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <Suspense>
          <SearchInput placeholder="ค้นหาชื่อ/อีเมล..." className="sm:w-64" />
        </Suspense>
        <Suspense>
          <StatusFilter options={roleOptions} paramName="role" />
        </Suspense>
        <Suspense>
          <StatusFilter options={statusFilterOptions} paramName="status" />
        </Suspense>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[230px]">ชื่อ-นามสกุล</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead className="w-[100px]">% ครบ</TableHead>
              <TableHead>สิทธิ์ (Role)</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="w-[140px] text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((profile) => {
              const pct = completionPct(profile);
              const corrCount = correctionCounts[profile.id as string] ?? 0;
              return (
                <TableRow
                  key={profile.id as string}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="font-medium">
                    {profile.full_name as string}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {profile.email as string}
                  </TableCell>
                  <TableCell>
                    {(profile.department as { name: string } | null)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    <CompletionCell pct={pct} />
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={profile.role as string} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={profile.status as string} />
                      {corrCount > 0 && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200"
                          title={`มีคำขอแก้ไข ${corrCount} รายการรอ HR`}
                        >
                          <FileEdit className="size-3" />
                          {corrCount}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <UserRowActions
                        id={profile.id as string}
                        status={profile.status as "approved" | "pending" | "rejected"}
                        fullName={profile.full_name as string}
                      />
                      <UserActionsMenu
                        profile={{
                          id: profile.id as string,
                          status: profile.status as "approved" | "pending" | "rejected",
                          role: profile.role as "admin" | "hr" | "manager" | "employee",
                          full_name: profile.full_name as string,
                          email: profile.email as string,
                        }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  {search || role !== "all" || status !== "all"
                    ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข"
                    : "ไม่พบข้อมูลผู้ใช้งาน"}
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

function RoleBadge({ role }: { role: string }) {
  const map: Record<
    string,
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
  > = {
    admin: { label: "Admin", variant: "default" },
    hr: { label: "HR", variant: "secondary" },
    manager: { label: "Manager", variant: "outline" },
    employee: { label: "Employee", variant: "outline" },
  };
  const config = map[role] || { label: role, variant: "outline" };
  return (
    <Badge variant={config.variant} className="capitalize">
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    approved: {
      label: "ใช้งานปกติ",
      className:
        "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/20",
    },
    pending: {
      label: "รออนุมัติ",
      className:
        "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20",
    },
    rejected: {
      label: "ระงับการใช้งาน",
      className:
        "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
    },
    pre_registered: {
      label: "ยังไม่เข้าระบบ",
      className:
        "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20 border-slate-500/20",
    },
    awaiting_confirmation: {
      label: "รอยืนยันข้อมูล",
      className:
        "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20",
    },
    awaiting_correction: {
      label: "รอการแก้ไข",
      className:
        "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-500/20",
    },
  };
  const config = map[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function CompletionCell({ pct }: { pct: number }) {
  const tone =
    pct >= 80
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  const textTone =
    pct >= 80
      ? "text-emerald-700"
      : pct >= 50
        ? "text-amber-700"
        : "text-rose-700";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-mono font-semibold tabular-nums", textTone)}>
        {pct}%
      </span>
    </div>
  );
}
