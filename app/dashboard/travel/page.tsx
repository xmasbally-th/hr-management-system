import Link from "next/link";
import { getMyTravelRequests } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";

export const metadata = { title: "ประวัติการเดินทาง" };

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

interface TravelExpense {
  id: string;
  expense_category: string;
  estimated_amount: number;
  actual_amount: number | null;
}

export default async function TravelPage() {
  const requests = await getMyTravelRequests();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ประวัติการเดินทาง</h1>
          <p className="text-muted-foreground">ดูประวัติและยื่นคำขอเดินทางราชการ</p>
        </div>
        <Link href="/dashboard/travel/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            ยื่นคำขอเดินทาง
          </Button>
        </Link>
      </div>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>ประเภท</TableHead>
              <TableHead>เรื่อง</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>งบประมาณ</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => {
              const status = statusMap[req.status] ?? { label: req.status, variant: "outline" as const };
              const expenses = (req.expenses ?? []) as TravelExpense[];
              const totalEstimated = expenses.reduce((sum, e) => sum + e.estimated_amount, 0);
              const totalActual = expenses.reduce((sum, e) => sum + (e.actual_amount ?? 0), 0);

              return (
                <TableRow key={req.id}>
                  <TableCell>
                    <Badge variant="outline">{travelTypeMap[req.travel_type] ?? req.travel_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{req.title}</TableCell>
                  <TableCell>{req.location}</TableCell>
                  <TableCell className="text-sm">
                    {req.start_date} ~ {req.end_date}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>ประมาณ: {totalEstimated.toLocaleString()} ฿</div>
                    {totalActual > 0 && (
                      <div className="text-green-600">จริง: {totalActual.toLocaleString()} ฿</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  ยังไม่มีประวัติการเดินทาง
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
