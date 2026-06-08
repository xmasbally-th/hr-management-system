"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTravelRequestByHr } from "@/lib/actions/travel-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThaiDatePicker } from "@/components/ui/thai-date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/file-upload";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ExpenseRow {
  category: string;
  amount: string;
}

interface Props {
  employees: { id: string; full_name: string; email: string }[];
}

export function PaperTravelForm({ employees }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [travelType, setTravelType] = useState("");
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([{ category: "", amount: "" }]);

  function calculateDays(): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 0);
  }

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

    if (!employeeId) { setError("กรุณาเลือกพนักงาน"); return; }
    if (!travelType) { setError("กรุณาเลือกประเภทการเดินทาง"); return; }
    if (!title) { setError("กรุณาระบุเรื่อง"); return; }
    if (!location) { setError("กรุณาระบุสถานที่"); return; }
    if (!startDate || !endDate) { setError("กรุณาระบุวันที่"); return; }

    const totalDays = calculateDays();
    if (totalDays <= 0) { setError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น"); return; }

    const validExpenses = expenses
      .filter((exp) => exp.category && exp.amount)
      .map((exp) => ({
        expense_category: exp.category,
        estimated_amount: Number(exp.amount) || 0,
      }));

    startTransition(async () => {
      try {
        await createTravelRequestByHr(employeeId, {
          travel_type: travelType as "training" | "supervision" | "official_contact",
          title,
          location,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          expenses: validExpenses,
        });

        // D5: document_tracking is created server-side inside
        // createTravelRequestByHr — no separate call needed here.

        toast.success("บันทึกคำขอเดินทางเรียบร้อยแล้ว");
        router.push("/dashboard/hr/travel");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(message);
        toast.error(message);
      }
    });
  }

  // Base UI Select.Value needs an items map to render the chosen label.
  const employeeItems = useMemo(
    () => Object.fromEntries(employees.map((emp) => [emp.id, `${emp.full_name} (${emp.email})`])),
    [employees],
  );
  const travelTypeItems: Record<string, string> = {
    training: "อบรม/สัมมนา",
    supervision: "นิเทศ",
    official_contact: "ติดต่อราชการ",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Employee selection */}
      <div className="space-y-2">
        <Label>พนักงาน <span className="text-destructive">*</span></Label>
        <Select items={employeeItems} value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกพนักงาน..." />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Travel type */}
      <div className="space-y-2">
        <Label>ประเภทการเดินทาง <span className="text-destructive">*</span></Label>
        <Select items={travelTypeItems} value={travelType} onValueChange={(v) => setTravelType(v ?? "")} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกประเภท..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="training">อบรม/สัมมนา</SelectItem>
            <SelectItem value="supervision">นิเทศ</SelectItem>
            <SelectItem value="official_contact">ติดต่อราชการ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">เรื่อง <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อหลักสูตร/งานที่เดินทาง"
          disabled={isPending}
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">สถานที่ <span className="text-destructive">*</span></Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="สถานที่เดินทาง"
          disabled={isPending}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">วันที่เริ่มต้น <span className="text-destructive">*</span></Label>
          <ThaiDatePicker
            id="startDate"
            value={startDate}
            onChange={setStartDate}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">วันที่สิ้นสุด <span className="text-destructive">*</span></Label>
          <ThaiDatePicker
            id="endDate"
            value={endDate}
            onChange={setEndDate}
            disabled={isPending}
          />
        </div>
      </div>

      {startDate && endDate && (
        <p className="text-sm text-muted-foreground">
          จำนวนวัน: <span className="font-semibold">{calculateDays()}</span> วัน
        </p>
      )}

      {/* Expenses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>รายการค่าใช้จ่าย (ประมาณการ)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addExpenseRow} disabled={isPending}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
          </Button>
        </div>
        {expenses.map((exp, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                placeholder="หมวดค่าใช้จ่าย (เช่น ค่าที่พัก)"
                value={exp.category}
                onChange={(e) => updateExpense(idx, "category", e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="w-32">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="จำนวนเงิน"
                value={exp.amount}
                onChange={(e) => updateExpense(idx, "amount", e.target.value)}
                disabled={isPending}
              />
            </div>
            {expenses.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExpenseRow(idx)}
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {expenses.some((e) => e.amount) && (
          <p className="text-sm text-muted-foreground text-right">
            รวม: <span className="font-semibold">
              {expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
            </span> บาท
          </p>
        )}
      </div>

      {/* Scanned document upload */}
      <FileUpload
        pathPrefix={`travel/${employeeId || "unknown"}/scanned`}
        onUploaded={() => {}}
        label="แนบสแกนเอกสาร (ถ้ามี)"
        disabled={isPending}
      />

      {/* Submit */}
      <div className="flex gap-4 justify-end pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          บันทึกคำขอเดินทาง
        </Button>
      </div>
    </form>
  );
}
