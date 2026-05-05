"use client";

import { useState, useTransition } from "react";
import { approveTravelRequest, rejectTravelRequest, completeTravelRequest, updateActualExpense } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

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

export function HrTravelClient({ requests }: { requests: TravelRequestRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "completed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  function handleApprove(id: string) {
    startTransition(async () => {
      try { await approveTravelRequest(id); }
      catch (err: unknown) { if (err instanceof Error) alert(err.message); }
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      try { await rejectTravelRequest(id); }
      catch (err: unknown) { if (err instanceof Error) alert(err.message); }
    });
  }

  function handleComplete(id: string) {
    if (!confirm("ยืนยันปิดงานเดินทางนี้?")) return;
    startTransition(async () => {
      try { await completeTravelRequest(id); }
      catch (err: unknown) { if (err instanceof Error) alert(err.message); }
    });
  }

  function handleUpdateActual(expenseId: string, value: string) {
    const amount = Number(value);
    if (isNaN(amount) || amount < 0) return;
    startTransition(async () => {
      try { await updateActualExpense(expenseId, amount); }
      catch (err: unknown) { if (err instanceof Error) alert(err.message); }
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
          ["completed", "เสร็จสิ้น"],
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
            {filtered.map((req) => {
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              const totalEstimated = req.expenses.reduce((s, e) => s + e.estimated_amount, 0);
              const totalActual = req.expenses.reduce((s, e) => s + (e.actual_amount ?? 0), 0);
              const isExpanded = expandedId === req.id;

              return (
                <TableRow key={req.id} className="group">
                  <TableCell>
                    {req.expenses.length > 0 && (
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
                      {req.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleApprove(req.id)} disabled={isPending} className="text-green-600 hover:text-green-700 hover:bg-green-50">
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleReject(req.id)} disabled={isPending} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <Button size="sm" variant="outline" onClick={() => handleComplete(req.id)} disabled={isPending}>
                          ปิดงาน
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
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
        const req = requests.find((r) => r.id === expandedId);
        if (!req || req.expenses.length === 0) return null;
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
    </div>
  );
}
