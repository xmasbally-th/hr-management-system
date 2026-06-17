"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearchInput } from "@/components/search-input";
import { ClientPaginationControls } from "@/components/pagination-controls";
import { formatThai } from "@/lib/date-ranges";
import { updateActualExpense } from "@/lib/actions/travel-actions";
import { ChevronRight, ChevronDown, ChevronUp, FileDown } from "lucide-react";
import { toast } from "sonner";

export interface TravelExpenseRow {
  id: string;
  expense_category: string;
  estimated_amount: number;
  actual_amount: number | null;
}

/** Row shape — superset of fields the travel hub loads per request. */
export interface TravelRequestRow {
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
  employee: { full_name: string; email?: string; position_title?: string | null } | null;
  expenses: TravelExpenseRow[];
}

/**
 * Single source of truth for travel-status display. `label` spells out which
 * step the request is at and who it waits on; `tone` drives the coloured dot
 * (amber = waiting on a signer, blue = HR's turn, green = done, red = stopped).
 * Travel has no chair stage.
 */
export const TRAVEL_STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    tone: "blue" | "amber" | "green" | "red" | "gray";
  }
> = {
  pending: { label: "รอ HR ตรวจสอบ/ส่งลงนาม", variant: "secondary", tone: "blue" },
  awaiting_director: { label: "รอผอ.สำนักงานลงนาม", variant: "secondary", tone: "amber" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary", tone: "amber" },
  approved: { label: "คณบดีลงนามแล้ว — รอ HR ส่งมหาวิทยาลัย", variant: "secondary", tone: "blue" },
  awaiting_university: { label: "รออธิการบดีลงนาม", variant: "secondary", tone: "amber" },
  completed: { label: "เสร็จสิ้น", variant: "default", tone: "green" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive", tone: "red" },
  cancelled: { label: "ยกเลิก", variant: "outline", tone: "gray" },
};

const TONE_DOT: Record<string, string> = {
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-destructive",
  gray: "bg-muted-foreground/40",
};

const TRAVEL_TYPE_MAP: Record<string, string> = {
  training: "อบรม/สัมมนา",
  supervision: "นิเทศ",
  official_contact: "ติดต่อราชการ",
};

const PAGE_SIZE = 15;

/**
 * Unified travel-request list table — client search + pagination + the row
 * action that routes to the detail page (the single action surface). HR/Admin
 * (`canEdit`) additionally get the .docx order download and an expandable
 * budget panel with inline actual-expense editing.
 */
export function TravelRequestTable({
  requests,
  canEdit = false,
  emptyText = "ไม่มีคำขอเดินทาง",
}: {
  requests: TravelRequestRow[];
  canEdit?: boolean;
  emptyText?: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.employee?.full_name?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q),
    );
  }, [requests, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
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

  const expandedReq = expandedId ? filtered.find((r) => r.id === expandedId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <ClientSearchInput
          value={search}
          onChange={handleSearch}
          placeholder="ค้นหาชื่อ, เรื่อง, สถานที่..."
          className="sm:w-80"
        />
        <span className="text-sm text-muted-foreground shrink-0">{filtered.length} รายการ</span>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>ผู้ขอเดินทาง</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>เรื่อง</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>งบประมาณ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((req) => {
              const status = TRAVEL_STATUS_MAP[req.status] ?? { label: req.status, variant: "outline" as const, tone: "gray" as const };
              const expenses = req.expenses ?? [];
              const totalEstimated = expenses.reduce((s, e) => s + Number(e.estimated_amount ?? 0), 0);
              const totalActual = expenses.reduce((s, e) => s + Number(e.actual_amount ?? 0), 0);
              const isExpanded = expandedId === req.id;
              const canDownload = canEdit && ["approved", "awaiting_university", "completed"].includes(req.status);
              return (
                <TableRow key={req.id} className="hover:bg-muted/50">
                  <TableCell>
                    {expenses.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        title={isExpanded ? "ซ่อนงบประมาณ" : "ดูงบประมาณ"}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{req.employee?.full_name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{req.employee?.position_title}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{TRAVEL_TYPE_MAP[req.travel_type] ?? req.travel_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{req.title}</TableCell>
                  <TableCell className="text-sm">{req.location}</TableCell>
                  <TableCell className="text-sm">
                    <p className="font-medium">{formatThai(req.start_date)}</p>
                    <p className="text-xs text-muted-foreground">ถึง {formatThai(req.end_date)}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{totalEstimated.toLocaleString()} ฿</div>
                    {totalActual > 0 && (
                      <div className="text-emerald-600 text-xs">จริง: {totalActual.toLocaleString()} ฿</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[status.tone]}`} />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canDownload && (
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
                      <Link
                        href={`/dashboard/travel/${req.id}`}
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        ดูรายละเอียด
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Expanded budget detail */}
      {expandedReq && expandedReq.expenses.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <h4 className="font-semibold text-sm">รายละเอียดงบประมาณ — {expandedReq.title}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>หมวด</TableHead>
                <TableHead>ประมาณการ (฿)</TableHead>
                <TableHead>จริง (฿)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expandedReq.expenses.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>{exp.expense_category}</TableCell>
                  <TableCell>{Number(exp.estimated_amount).toLocaleString()}</TableCell>
                  <TableCell>
                    {canEdit && ["approved", "completed"].includes(expandedReq.status) ? (
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
                      <span>{exp.actual_amount != null ? Number(exp.actual_amount).toLocaleString() : "-"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientPaginationControls
        currentPage={page}
        totalCount={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
