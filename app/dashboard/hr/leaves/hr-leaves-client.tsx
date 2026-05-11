"use client";

import { useTransition, useState } from "react";
import { approveLeaveRequest, rejectLeaveRequest } from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

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

export function HrLeavesClient({ requests }: { requests: (LeaveRequestRow | Record<string, unknown>)[] }) {
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject";
    id: string;
    employeeName: string;
  } | null>(null);

  function openApproveDialog(id: string, name: string) {
    setConfirmAction({ type: "approve", id, employeeName: name });
  }

  function openRejectDialog(id: string, name: string) {
    setConfirmAction({ type: "reject", id, employeeName: name });
  }

  function handleConfirm(reason?: string) {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setConfirmAction(null);

    startTransition(async () => {
      try {
        if (type === "approve") {
          await approveLeaveRequest(id);
          toast.success("อนุมัติการลาเรียบร้อยแล้ว");
        } else {
          await rejectLeaveRequest(id, reason || undefined);
          toast.success("ปฏิเสธการลาเรียบร้อยแล้ว");
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  return (
    <div className="space-y-4">
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
            {requests.map((raw) => {
              const req = raw as LeaveRequestRow;
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
                          onClick={() => openApproveDialog(req.id, req.employee?.full_name ?? "-")}
                          disabled={isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openRejectDialog(req.id, req.employee?.full_name ?? "-")}
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
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  ไม่มีคำขอลาในหมวดนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmAction?.type === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันอนุมัติการลา"
        description={`คุณต้องการอนุมัติคำขอลาของ ${confirmAction?.employeeName ?? ""} ใช่หรือไม่?`}
        confirmLabel="อนุมัติ"
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirmAction?.type === "reject"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันปฏิเสธการลา"
        description={`คุณต้องการปฏิเสธคำขอลาของ ${confirmAction?.employeeName ?? ""} ใช่หรือไม่?`}
        confirmLabel="ปฏิเสธ"
        variant="destructive"
        withInput
        inputLabel="เหตุผล (ถ้ามี)"
        inputPlaceholder="ระบุเหตุผลที่ไม่อนุมัติ..."
        onConfirm={handleConfirm}
      />
    </div>
  );
}
