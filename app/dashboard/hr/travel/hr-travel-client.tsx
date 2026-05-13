"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approveTravelRequest, rejectTravelRequest, completeTravelRequest, updateActualExpense } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, FileDown, Eye } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

interface TravelExpense {
  id: string;
  expense_category: string;
  estimated_amount: number;
  actual_amount: number | null;
}

interface TravelRequestRow {
  id: string;
  employee_id: string;
  travel_type: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  total_days: number;
  submission_channel: string | null;
  status: string;
  created_at: string;
  employee: { full_name: string; email: string; department_id: string | null } | null;
  expenses: TravelExpense[];
}

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

export function HrTravelClient({ requests }: { requests: (TravelRequestRow | Record<string, unknown>)[] }) {
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "approve" | "reject" | "complete";
    id: string;
    employeeName: string;
  } | null>(null);

  function handleConfirm() {
    if (!confirmAction) return;
    const { type, id } = confirmAction;
    setConfirmAction(null);

    startTransition(async () => {
      try {
        if (type === "approve") {
          await approveTravelRequest(id);
          toast.success("อนุมัติการเดินทางเรียบร้อยแล้ว");
        } else if (type === "reject") {
          await rejectTravelRequest(id);
          toast.success("ปฏิเสธการเดินทางเรียบร้อยแล้ว");
        } else {
          await completeTravelRequest(id);
          toast.success("ปิดงานเดินทางเรียบร้อยแล้ว");
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  function handleUpdateActual(expenseId: string, value: string) {
    const amount = Number(value);
    if (isNaN(amount) || amount < 0) return;
    startTransition(async () => {
      try {
        await updateActualExpense(expenseId, amount);
        toast.success("บันทึกค่าใช้จ่ายจริงแล้ว");
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
              <TableHead className="w-8"></TableHead>
              <TableHead>พนักงาน</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>เรื่อง</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>งบประมาณ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((raw) => {
              const req = raw as TravelRequestRow;
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              const expenses = req.expenses ?? [];
              const totalEstimated = expenses.reduce((s, e) => s + e.estimated_amount, 0);
              const totalActual = expenses.reduce((s, e) => s + (e.actual_amount ?? 0), 0);
              const isExpanded = expandedId === req.id;

              return (
                <TableRow key={req.id} className="group">
                  <TableCell>
                    {expenses.length > 0 && (
                      <button onClick={() => setExpandedId(isExpanded ? null : req.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{req.employee?.full_name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{req.employee?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{travelTypeMap[req.travel_type] ?? req.travel_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{req.title}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {req.start_date} ~ {req.end_date}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{totalEstimated.toLocaleString()} ฿</div>
                    {totalActual > 0 && (
                      <div className="text-green-600 text-xs">จริง: {totalActual.toLocaleString()} ฿</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Link href={`/dashboard/travel/${req.id}`}>
                        <Button size="icon" variant="ghost" title="ดูรายละเอียด">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {req.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: "approve", id: req.id, employeeName: req.employee?.full_name ?? "-" })} disabled={isPending} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setConfirmAction({ type: "reject", id: req.id, employeeName: req.employee?.full_name ?? "-" })} disabled={isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: "complete", id: req.id, employeeName: req.employee?.full_name ?? "-" })} disabled={isPending}>
                          ปิดงาน
                        </Button>
                      )}
                      {(req.status === "approved" || req.status === "completed") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(`/api/documents/travel-order/${req.id}`, "_blank")}
                          title="ดาวน์โหลดคำสั่งเดินทาง"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  ไม่มีคำขอเดินทางในหมวดนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Expanded expense detail */}
      {expandedId && (() => {
        const req = requests.find((r) => (r as TravelRequestRow).id === expandedId) as TravelRequestRow | undefined;
        if (!req || !req.expenses || req.expenses.length === 0) return null;
        return (
          <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <h4 className="font-semibold text-sm">รายละเอียดงบประมาณ — {req.title}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>หมวด</TableHead>
                  <TableHead>ประมาณการ (฿)</TableHead>
                  <TableHead>จริง (฿)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {req.expenses.map((exp) => (
                  <TableRow key={exp.id}>
                    <TableCell>{exp.expense_category}</TableCell>
                    <TableCell>{exp.estimated_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      {req.status === "approved" || req.status === "completed" ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={exp.actual_amount ?? ""}
                          onBlur={(e) => handleUpdateActual(exp.id, e.target.value)}
                          className="w-28 h-8"
                          placeholder="0.00"
                          disabled={isPending}
                        />
                      ) : (
                        <span>{exp.actual_amount?.toLocaleString() ?? "-"}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })()}

      {/* Confirmation dialogs */}
      <ConfirmDialog
        open={confirmAction?.type === "approve"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันอนุมัติการเดินทาง"
        description={`คุณต้องการอนุมัติคำขอเดินทางของ ${confirmAction?.employeeName ?? ""} ใช่หรือไม่?`}
        confirmLabel="อนุมัติ"
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirmAction?.type === "reject"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันปฏิเสธการเดินทาง"
        description={`คุณต้องการปฏิเสธคำขอเดินทางของ ${confirmAction?.employeeName ?? ""} ใช่หรือไม่?`}
        confirmLabel="ปฏิเสธ"
        variant="destructive"
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={confirmAction?.type === "complete"}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="ยืนยันปิดงานเดินทาง"
        description={`คุณต้องการปิดงานเดินทางของ ${confirmAction?.employeeName ?? ""} ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ปิดงาน"
        onConfirm={handleConfirm}
      />
    </div>
  );
}
