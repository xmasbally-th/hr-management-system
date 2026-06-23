"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateActualExpense } from "@/lib/actions/travel-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

interface Expense {
  id: string;
  expense_category: string;
  estimated_amount: number;
  actual_amount: number | null;
}

interface Props {
  expenses: Expense[];
  canEditActual: boolean;
}

export function TravelExpensesTable({ expenses, canEditActual }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setEditValue(exp.actual_amount?.toString() ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  function saveEdit(expenseId: string) {
    const amount = Number(editValue);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("กรุณาระบุจำนวนเงินที่ถูกต้อง");
      return;
    }

    startTransition(async () => {
      try {
        await updateActualExpense(expenseId, amount);
        toast.success("บันทึกค่าใช้จ่ายจริงแล้ว");
        setEditingId(null);
        setEditValue("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  if (expenses.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        ไม่มีรายการค่าใช้จ่าย
      </div>
    );
  }

  return (
    <Table>
      <TableHeader className="bg-muted/50">
        <TableRow>
          <TableHead>รายการ</TableHead>
          <TableHead className="text-right">งบประมาณ (บาท)</TableHead>
          <TableHead className="text-right">เบิกจริง (บาท)</TableHead>
          {canEditActual && <TableHead className="w-24"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((exp) => {
          const isEditing = editingId === exp.id;
          return (
            <TableRow key={exp.id}>
              <TableCell>{exp.expense_category}</TableCell>
              <TableCell className="text-right">{Number(exp.estimated_amount).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                {isEditing ? (
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-8 w-32 ml-auto text-right"
                    autoFocus
                  />
                ) : exp.actual_amount !== null ? (
                  Number(exp.actual_amount).toLocaleString()
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              {canEditActual && (
                <TableCell>
                  {isEditing ? (
                    <div className="flex gap-1 justify-end">
                      <Button
                        aria-label="บันทึกค่าใช้จ่ายจริง"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => saveEdit(exp.id)}
                        disabled={isPending}
                      >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                      </Button>
                      <Button
                        aria-label="ยกเลิก"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={cancelEdit}
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      aria-label="แก้ไขค่าใช้จ่ายจริง"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 ml-auto block"
                      onClick={() => startEdit(exp)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
