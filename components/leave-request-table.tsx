"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientSearchInput } from "@/components/search-input";
import { ClientPaginationControls } from "@/components/pagination-controls";
import { formatThai } from "@/lib/date-ranges";
import { ChevronRight, FileCheck, FileX } from "lucide-react";

/** Row shape — superset of fields the leave hub loads per request. */
export interface LeaveRequestRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  working_days: number | null;
  status: string;
  submission_channel: string | null;
  medical_cert_url: string | null;
  leave_type_id: string;
  leave_type: { name: string; code: string | null } | null;
  employee: { full_name: string; email?: string; position_title?: string | null } | null;
}

/**
 * Single source of truth for leave-status display. `label` spells out which
 * step the request is at and who it waits on; `tone` drives the coloured dot
 * (amber = waiting on someone, blue = HR's turn, green = done, red = stopped).
 */
export const LEAVE_STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    tone: "blue" | "amber" | "green" | "red" | "gray";
  }
> = {
  pending: { label: "รอ HR ตรวจสอบ/ส่งลงนาม", variant: "secondary", tone: "blue" },
  awaiting_chair: { label: "รอประธานสาขาให้ความเห็น", variant: "secondary", tone: "amber" },
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

const PAGE_SIZE = 15;

/**
 * Unified leave-request list table — client search + pagination + the row
 * action that routes to the detail page (the single action surface).
 * Replaces the former duplicate hr-leaves-client + leaves-list-view.
 */
export function LeaveRequestTable({
  requests,
  emptyText = "ไม่มีรายการลา",
}: {
  requests: LeaveRequestRow[];
  emptyText?: string;
}) {
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
        <span className="text-sm text-muted-foreground shrink-0">{filtered.length} รายการ</span>
      </div>

      {/* Mobile (<md): stacked cards — avoids horizontal-scrolling an 8-col table */}
      <ul className="space-y-2.5 md:hidden">
        {pageRows.map((req) => {
          const status = LEAVE_STATUS_MAP[req.status] ?? { label: req.status, variant: "outline" as const, tone: "gray" as const };
          return (
            <li key={req.id}>
              <Link
                href={`/dashboard/leaves/${req.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors active:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight truncate">{req.employee?.full_name ?? "-"}</p>
                    {req.employee?.position_title && (
                      <p className="text-xs text-muted-foreground truncate">{req.employee.position_title}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>

                <div className="mt-2 flex items-start gap-1.5 text-sm font-medium">
                  <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${TONE_DOT[status.tone]}`} />
                  <span>{status.label}</span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">ประเภท</dt>
                    <dd>{req.leave_type?.name ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">จำนวน</dt>
                    <dd>
                      <span className="font-mono font-semibold">{req.total_days}</span> วัน
                      {req.working_days != null && req.working_days !== req.total_days && (
                        <span className="text-xs text-muted-foreground"> ({req.working_days} ทำการ)</span>
                      )}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">วันที่</dt>
                    <dd className="font-mono">{formatThai(req.start_date)} – {formatThai(req.end_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ช่องทาง</dt>
                    <dd>{req.submission_channel === "paper" ? "กระดาษ" : "ออนไลน์"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ใบรับรองแพทย์</dt>
                    <dd className="flex items-center gap-1.5">
                      {req.medical_cert_url ? (
                        <><FileCheck className="h-4 w-4 text-emerald-600" /> มี</>
                      ) : (
                        <span className="text-muted-foreground">ไม่มี</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="rounded-lg border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {emptyText}
          </li>
        )}
      </ul>

      {/* Tablet/desktop (md+): full table */}
      <div className="hidden md:block border border-border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ผู้ลา</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>จำนวน</TableHead>
              <TableHead className="text-center">ใบรับรอง</TableHead>
              <TableHead>ช่องทาง</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((req) => {
              const status = LEAVE_STATUS_MAP[req.status] ?? { label: req.status, variant: "outline" as const, tone: "gray" as const };
              return (
                <TableRow key={req.id} className="hover:bg-muted/50">
                  <TableCell>
                    <p className="font-medium">{req.employee?.full_name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{req.employee?.position_title}</p>
                  </TableCell>
                  <TableCell>{req.leave_type?.name ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    <p className="font-medium">{formatThai(req.start_date)}</p>
                    <p className="text-xs text-muted-foreground">ถึง {formatThai(req.end_date)}</p>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-semibold">{req.total_days}</span>
                    <span className="text-muted-foreground text-sm"> วัน</span>
                    {req.working_days != null && req.working_days !== req.total_days && (
                      <div className="text-xs text-muted-foreground">({req.working_days} วันทำการ)</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span title={req.medical_cert_url ? "มีใบรับรองแพทย์" : "ไม่มีใบรับรองแพทย์"}>
                      {req.medical_cert_url ? (
                        <FileCheck className="h-4 w-4 text-emerald-600 mx-auto" />
                      ) : (
                        <FileX className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {req.submission_channel === "paper" ? "กระดาษ" : "ออนไลน์"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant} className="gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[status.tone]}`} />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/dashboard/leaves/${req.id}`}
                      className="inline-flex items-center text-sm text-primary hover:underline"
                    >
                      ดูรายละเอียด
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {emptyText}
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
