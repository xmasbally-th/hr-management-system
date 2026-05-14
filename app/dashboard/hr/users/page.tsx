import { Suspense } from "react";
import { getProfiles } from "@/lib/actions/user-actions";
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
import { Plus, Upload } from "lucide-react";
import { SearchInput } from "@/components/search-input";
import { PaginationControls } from "@/components/pagination-controls";
import { StatusFilter } from "@/components/status-filter";
import { StatusStatStrip } from "@/components/status-stat-strip";
import { createClient } from "@/lib/supabase/server";

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
  const [totalRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected"),
  ]);
  return {
    total: totalRes.count ?? 0,
    pending: pendingRes.count ?? 0,
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

  const [result, counts] = await Promise.all([
    getProfiles({ page, search, role, status }),
    getStatusCounts(),
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
            { value: "pending", label: "รออนุมัติ", count: counts.pending, tone: "amber" },
            { value: "approved", label: "ใช้งานปกติ", count: counts.approved, tone: "emerald" },
            { value: "rejected", label: "ระงับ", count: counts.rejected, tone: "rose" },
          ]}
        />
      </Suspense>

      {/* Search + Role Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Suspense>
          <SearchInput placeholder="ค้นหาชื่อ/อีเมล..." className="sm:w-64" />
        </Suspense>
        <Suspense>
          <StatusFilter options={roleOptions} paramName="role" />
        </Suspense>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[250px]">ชื่อ-นามสกุล</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>แผนก</TableHead>
              <TableHead>สิทธิ์ (Role)</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="w-[140px] text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.map((profile) => (
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
                  <RoleBadge role={profile.role as string} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={profile.status as string} />
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
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {result.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
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
        "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20",
    },
    pending: {
      label: "รออนุมัติ",
      className:
        "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20",
    },
    rejected: {
      label: "ระงับการใช้งาน",
      className:
        "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20",
    },
  };
  const config = map[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
