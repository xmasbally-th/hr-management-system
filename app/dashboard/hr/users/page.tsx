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

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = {
  title: "จัดการผู้ใช้งาน",
};

export default async function UsersPage() {
  const profiles = await getProfiles();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการผู้ใช้งาน</h1>
          <p className="text-muted-foreground">รายชื่อพนักงาน สถานะ และสิทธิ์การเข้าถึงระบบ</p>
        </div>
        <Link href="/dashboard/hr/users/add" className={buttonVariants({ variant: "default" })}>
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มพนักงาน
        </Link>
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
              <TableHead className="w-[80px] text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id} className="hover:bg-muted/30">
                <TableCell className="font-medium">{profile.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                <TableCell>{(profile.department as { name: string } | null)?.name || "-"}</TableCell>
                <TableCell>
                  <RoleBadge role={profile.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={profile.status} />
                </TableCell>
                <TableCell className="text-right">
                  <UserActionsMenu profile={profile} />
                </TableCell>
              </TableRow>
            ))}
            {profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  ไม่พบข้อมูลผู้ใช้งาน
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string, variant: "default" | "secondary" | "outline" | "destructive" }> = {
    admin: { label: "Admin", variant: "default" },
    hr: { label: "HR", variant: "secondary" },
    manager: { label: "Manager", variant: "outline" },
    employee: { label: "Employee", variant: "outline" },
  };
  const config = map[role] || { label: role, variant: "outline" };
  
  // Since Shadcn default Badge variants are limited, we use standard variants here 
  // but we can add extra classes if we want custom colors.
  return <Badge variant={config.variant} className="capitalize">{config.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, className: string }> = {
    approved: { label: "ใช้งานปกติ", className: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20" },
    pending: { label: "รออนุมัติ", className: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20" },
    rejected: { label: "ระงับการใช้งาน", className: "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20" },
  };
  const config = map[status] || { label: status, className: "" };
  
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
