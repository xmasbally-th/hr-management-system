"use client";

import { useState, useTransition } from "react";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface LeaveRequestRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  submission_channel: string | null;
  created_at: string;
  leave_type: { name: string } | null;
  employee: { full_name: string; email: string; department_id: string | null } | null;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

export function HrLeavesClient({ requests }: { requests: LeaveRequestRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  function handleApprove(id: string) {
    startTransition(async () => {
      try {
        await approveLeaveRequest(id);
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  function handleReject(id: string) {
    const reason = prompt("เหตุผลที่ไม่อนุมัติ (ถ้ามี):");
    startTransition(async () => {
      try {
        await rejectLeaveRequest(id, reason ?? undefined);
      } catch (err: unknown) {
        if (err instanceof Error) alert(err.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {([
          ["all", "ทั้งหมด"],
          ["pending", "รออนุมัติ"],
          ["approved", "อนุมัติแล้ว"],
          ["rejected", "ไม่อนุมัติ"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            {label}
            {key === "pending" && (
              <span className="ml-1.5 text-xs">
                ({requests.filter((r) => r.status === "pending").length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>พนักงาน</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>จำนวน</TableHead>
              <TableHead>ช่องทาง</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((req) => {
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              return (
                <TableRow key={req.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{req.employee?.full_name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{req.employee?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{req.leave_type?.name ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    {req.start_date} ~ {req.end_date}
                  </TableCell>
                  <TableCell>{req.total_days} วัน</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {req.submission_channel === "paper" ? "กระดาษ" : "ออนไลน์"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {req.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleApprove(req.id)}
                          disabled={isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleReject(req.id)}
                          disabled={isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  ไม่มีคำขอลาในหมวดนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
