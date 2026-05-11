"use client";

import { useState, useTransition } from "react";
import { deleteTraining } from "@/lib/actions/training-actions";
import { getTrainingTypeLabel } from "@/lib/training-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";

interface TrainingRow {
  id: string;
  employee_id: string;
  course_name: string;
  training_type: string;
  location: string | null;
  start_date: string;
  end_date: string;
  total_hours: number | null;
  total_cost: number | null;
  created_at: string;
  employee: { full_name: string; email: string } | null;
}

export function HrTrainingsClient({ trainings }: { trainings: (TrainingRow | Record<string, unknown>)[] }) {
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    courseName: string;
    employeeName: string;
  } | null>(null);

  function handleDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);

    startTransition(async () => {
      try {
        await deleteTraining(id);
        toast.success("ลบข้อมูลการอบรมเรียบร้อยแล้ว");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>พนักงาน</TableHead>
              <TableHead>หลักสูตร</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>สถานที่</TableHead>
              <TableHead>วันที่</TableHead>
              <TableHead>ชม.</TableHead>
              <TableHead>ค่าใช้จ่าย</TableHead>
              <TableHead className="w-16">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainings.map((raw) => {
              const t = raw as TrainingRow;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{t.employee?.full_name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{t.employee?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{t.course_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTrainingTypeLabel(t.training_type)}</Badge>
                  </TableCell>
                  <TableCell>{t.location || "-"}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {t.start_date} ~ {t.end_date}
                  </TableCell>
                  <TableCell>{t.total_hours ?? "-"}</TableCell>
                  <TableCell>
                    {t.total_cost ? `${t.total_cost.toLocaleString()} ฿` : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget({
                        id: t.id,
                        courseName: t.course_name,
                        employeeName: t.employee?.full_name ?? "-",
                      })}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {trainings.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  ไม่มีข้อมูลการอบรม
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันลบข้อมูลการอบรม"
        description={`คุณต้องการลบประวัติอบรม "${deleteTarget?.courseName ?? ""}" ของ ${deleteTarget?.employeeName ?? ""} ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบ"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
