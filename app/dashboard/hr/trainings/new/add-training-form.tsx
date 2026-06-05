"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTraining } from "@/lib/actions/training-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  employees: { id: string; full_name: string; email: string }[];
  trainingTypes: { value: string; label: string }[];
}

export function AddTrainingForm({ employees, trainingTypes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [courseName, setCourseName] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalHours, setTotalHours] = useState("");
  const [totalCost, setTotalCost] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employeeId) { setError("กรุณาเลือกพนักงาน"); return; }
    if (!courseName.trim()) { setError("กรุณาระบุชื่อหลักสูตร"); return; }
    if (!trainingType) { setError("กรุณาเลือกประเภทการอบรม"); return; }
    if (!startDate || !endDate) { setError("กรุณาระบุวันที่"); return; }

    if (new Date(endDate) < new Date(startDate)) {
      setError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      return;
    }

    startTransition(async () => {
      try {
        await createTraining({
          employee_id: employeeId,
          course_name: courseName.trim(),
          training_type: trainingType,
          location: location.trim() || null,
          start_date: startDate,
          end_date: endDate,
          total_hours: totalHours ? Number(totalHours) : null,
          total_cost: totalCost ? Number(totalCost) : null,
        });

        toast.success("บันทึกประวัติอบรมเรียบร้อยแล้ว");
        router.push("/dashboard/hr/trainings");
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
  const trainingTypeItems = useMemo(
    () => Object.fromEntries(trainingTypes.map((tt) => [tt.value, tt.label])),
    [trainingTypes],
  );

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

      {/* Course name */}
      <div className="space-y-2">
        <Label htmlFor="courseName">ชื่อหลักสูตร <span className="text-destructive">*</span></Label>
        <Input
          id="courseName"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="ชื่อหลักสูตร/การอบรม/สัมมนา"
          disabled={isPending}
        />
      </div>

      {/* Training type */}
      <div className="space-y-2">
        <Label>ประเภทการอบรม <span className="text-destructive">*</span></Label>
        <Select items={trainingTypeItems} value={trainingType} onValueChange={(v) => setTrainingType(v ?? "")} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกประเภท..." />
          </SelectTrigger>
          <SelectContent>
            {trainingTypes.map((tt) => (
              <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">สถานที่</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="สถานที่อบรม"
          disabled={isPending}
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">วันที่เริ่มต้น <span className="text-destructive">*</span></Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">วันที่สิ้นสุด <span className="text-destructive">*</span></Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Hours and Cost */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="totalHours">จำนวนชั่วโมง</Label>
          <Input
            id="totalHours"
            type="number"
            min="0"
            step="0.5"
            value={totalHours}
            onChange={(e) => setTotalHours(e.target.value)}
            placeholder="0"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalCost">ค่าใช้จ่าย (บาท)</Label>
          <Input
            id="totalCost"
            type="number"
            min="0"
            step="0.01"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            placeholder="0.00"
            disabled={isPending}
          />
        </div>
      </div>

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
          บันทึกประวัติอบรม
        </Button>
      </div>
    </form>
  );
}
