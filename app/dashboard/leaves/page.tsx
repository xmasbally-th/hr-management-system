import Link from "next/link";
import { getMyLeaveRequests, getMyLeaveBalances } from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export const metadata = { title: "ประวัติการลา" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

export default async function LeavesPage() {
  const [requests, balances] = await Promise.all([
    getMyLeaveRequests(),
    getMyLeaveBalances(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ประวัติการลา</h1>
          <p className="text-muted-foreground">ดูประวัติและยื่นคำขอลาใหม่</p>
        </div>
        <Link href="/dashboard/leaves/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            ยื่นคำขอลา
          </Button>
        </Link>
      </div>

      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.id} className="border rounded-lg p-4 bg-card">
              <p className="text-sm text-muted-foreground">{(b.leave_type as { name: string } | null)?.name ?? "ไม่ทราบประเภท"}</p>
              <p className="text-2xl font-bold">{b.remaining_days}</p>
              <p className="text-xs text-muted-foreground">คงเหลือจาก {b.total_days} วัน</p>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>วันที่เริ่ม</TableHead>
              <TableHead>วันที่สิ้นสุด</TableHead>
              <TableHead>จำนวนวัน</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>วันที่ยื่น</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => {
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              return (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {(req.leave_type as { name: string } | null)?.name ?? "-"}
                  </TableCell>
                  <TableCell>{req.start_date}</TableCell>
                  <TableCell>{req.end_date}</TableCell>
                  <TableCell>{req.total_days}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString("th-TH")}
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ยังไม่มีประวัติการลา
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
