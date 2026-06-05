"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearchInput } from "@/components/search-input";
import { ClientPaginationControls } from "@/components/pagination-controls";
import { formatThai } from "@/lib/date-ranges";
import { ChevronRight } from "lucide-react";
import type { LeaveRequestRow } from "../leaves-dashboard-client";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  awaiting_director: { label: "รอผอ.ลงนาม", variant: "secondary" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary" },
  approved: { label: "อนุมัติแล้ว", variant: "default" },
  awaiting_university: { label: "รออธิการบดี", variant: "secondary" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

const PAGE_SIZE = 15;

export function LeavesListView({ requests }: { requests: LeaveRequestRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter(
      (r) =>
        r.employee?.full_name?.toLowerCase().includes(q) ||
        r.leave_type?.name?.toLowerCase().includes(q),
    );
  }, [requests, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <ClientSearchInput
          value={search}
          onChange={handleSearch}
          placeholder="ค้นหาชื่อ, ประเภทการลา..."
          className="sm:w-80"
        />
        <span className="text-sm text-muted-foreground shrink-0">
          {filtered.length} รายการ
        </span>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>วันที่เริ่ม-สิ้นสุด</TableHead>
              <TableHead>ผู้ลา</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>จำนวนวัน</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((req) => {
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              return (
                <TableRow key={req.id}>
                  <TableCell>
                    <p className="font-medium">{formatThai(req.start_date)}</p>
                    <p className="text-xs text-muted-foreground">
                      ถึง {formatThai(req.end_date)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{req.employee?.full_name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{req.employee?.position_title}</p>
                  </TableCell>
                  <TableCell>{req.leave_type?.name ?? "-"}</TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold">{req.total_days}</span>
                    <span className="text-muted-foreground text-sm"> วัน</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/leaves/${req.id}`}
                      className="inline-flex items-center text-sm text-primary hover:underline"
                    >
                      เดินเอกสาร
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ไม่มีรายการลาในรอบนี้
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ClientPaginationControls
        currentPage={page}
        totalCount={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
