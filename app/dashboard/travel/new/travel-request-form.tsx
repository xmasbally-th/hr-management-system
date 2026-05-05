"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTravelRequest, type CreateTravelRequestInput } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface ExpenseRow {
  category: string;
  amount: string;
}

const EXPENSE_CATEGORIES = [
  "ค่าเบี้ยเลี้ยง",
  "ค่าที่พัก",
  "ค่าพาหนะ",
  "ค่าน้ำมัน/ทางด่วน",
  "ค่าลงทะเบียน",
  "อื่นๆ",
];

export function TravelRequestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [travelType, setTravelType] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    { category: "", amount: "" },
  ]);

  function calculateDays(): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }

  const totalDays = calculateDays();
  const totalBudget = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  function addExpenseRow() {
    setExpenses([...expenses, { category: "", amount: "" }]);
  }

  function removeExpenseRow(index: number) {
    setExpenses(expenses.filter((_, i) => i !== index));
  }

  function updateExpense(index: number, field: keyof ExpenseRow, value: string) {
    const updated = [...expenses];
    updated[index] = { ...updated[index], [field]: value };
    setExpenses(updated);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!travelType || !title || !location || !startDate || !endDate) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (totalDays <= 0) {
      setError("วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่ม");
      return;
    }

    const validExpenses = expenses.filter((e) => e.category && Number(e.amount) > 0);

    const input: CreateTravelRequestInput = {
      travel_type: travelType as "training" | "supervision" | "official_contact",
      title,
      location,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      submission_channel: "digital",
      expenses: validExpenses.map((e) => ({
        expense_category: e.category,
        estimated_amount: Number(e.amount),
      })),
    };

    startTransition(async () => {
      try {
        await createTravelRequest(input);
        router.push("/dashboard/travel");
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Travel Type */}
      <div className="space-y-2">
        <Label>ประเภทการเดินทาง *</Label>
        <Select value={travelType} onValueChange={(v) => setTravelType(v ?? "")} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกประเภท..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="training">อบรม/สัมมนา</SelectItem>
            <SelectItem value="supervision">นิเทศนักศึกษา</SelectItem>
            <SelectItem value="official_contact">ติดต่อราชการ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>เรื่อง/หัวข้อ *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น อบรมหลักสูตร..."
          disabled={isPending}
          required
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>สถานที่ *</Label>
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="เช่น โรงแรม... จ.เชียงใหม่"
          disabled={isPending}
          required
        />
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันที่เริ่ม *</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={isPending} required />
        </div>
        <div className="space-y-2">
          <Label>วันที่สิ้นสุด *</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={isPending} required />
        </div>
      </div>

      {totalDays > 0 && (
        <p className="text-sm text-muted-foreground">จำนวนวัน: <strong>{totalDays}</strong> วัน</p>
      )}

      {/* Expenses (Estimated Budget) */}
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">งบประมาณ (ประมาณการ)</h3>
          <Button type="button" variant="outline" size="sm" onClick={addExpenseRow} disabled={isPending}>
            <Plus className="h-3 w-3 mr-1" />
            เพิ่มรายการ
          </Button>
        </div>

        {expenses.map((exp, i) => (
          <div key={i} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              {i === 0 && <Label className="text-xs">หมวดค่าใช้จ่าย</Label>}
              <Select value={exp.category} onValueChange={(v) => updateExpense(i, "category", v ?? "")} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหมวด..." />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-1">
              {i === 0 && <Label className="text-xs">จำนวนเงิน (฿)</Label>}
              <Input
                type="number"
                min="0"
                step="0.01"
                value={exp.amount}
                onChange={(e) => updateExpense(i, "amount", e.target.value)}
                placeholder="0.00"
                disabled={isPending}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeExpenseRow(i)}
              disabled={isPending || expenses.length <= 1}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {totalBudget > 0 && (
          <p className="text-sm font-medium text-right">
            รวมงบประมาณ: <span className="text-primary">{totalBudget.toLocaleString()} ฿</span>
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !travelType || !title || !location || !startDate || !endDate}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        ส่งคำขอเดินทาง
      </Button>
    </form>
  );
}
