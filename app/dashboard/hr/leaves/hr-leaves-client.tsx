"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, FileCheck, FileX } from "lucide-react";

interface LeaveRequestRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  working_days: number | null;
  reason: string | null;
  status: string;
  submission_channel: string | null;
  medical_cert_url: string | null;
  created_at: string;
  leave_type: { name: string } | null;
  employee: { full_name: string; email: string; department_id: string | null } | null;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รอตรวจสอบ", variant: "secondary" },
  awaiting_chair: { label: "รอประธานสาขา", variant: "secondary" },
  awaiting_director: { label: "รอผอ.ลงนาม", variant: "secondary" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  awaiting_university: { label: "รออธิการบดี", variant: "secondary" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

export function HrLeavesClient({ requests }: { requests: (LeaveRequestRow | Record<string, unknown>)[] }) {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>พนักงาน</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>จำนวน</TableHead>
              <TableHead>ใบรับรอง</TableHead>
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
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-mono">{req.total_days}</span> วัน
                      {req.working_days != null && req.working_days !== req.total_days && (
                        <div className="text-xs text-muted-foreground">
                          ({req.working_days} วันทำการ)
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span title={req.medical_cert_url ? "มีใบรับรองแพทย์" : "ไม่มีใบรับรองแพทย์"}>
                      {req.medical_cert_url ? (
                        <FileCheck className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <FileX className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {req.submission_channel === "paper" ? "กระดาษ" : "ออนไลน์"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/leaves/${req.id}`}>
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1.5" />
                        เดินเอกสาร
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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
