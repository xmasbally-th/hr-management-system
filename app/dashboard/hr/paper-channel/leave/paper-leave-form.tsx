"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLeaveRequestByHr,
  previewWorkingDays,
} from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/file-upload";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import type { LeaveType } from "@/types/supabase";

interface PaperEmployee {
  id: string;
  full_name: string;
  email: string;
  gender: string | null;
  employee_type: string | null;
}

interface Props {
  leaveTypes: LeaveType[];
  employees: PaperEmployee[];
}

/** Vacation accumulation cap label per employee type (mirrors digital form). */
function vacationCapLabel(employeeType: string | null): string {
  switch (employeeType) {
    case "ข้าราชการ":
      return "ข้าราชการ — สะสมสูงสุด 30 วัน";
    case "พนักงานมหาวิทยาลัย":
      return "พนักงานมหาวิทยาลัย — สะสมสูงสุด 20 วัน";
    case "พนักงานราชการ":
      return "พนักงานราชการ — สะสมสูงสุด 15 วัน";
    default:
      return "ประเภทนี้ไม่มีสิทธิ์สะสมวันลาข้ามปี";
  }
}

export function PaperLeaveForm({ leaveTypes, employees }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [medicalCertPath, setMedicalCertPath] = useState("");

  // Vacation-specific (accumulated/annual days come from leave_balances on
  // the server — B2). Form only collects substitutes + opinion.
  const [substitute1Id, setSubstitute1Id] = useState("");
  const [substitute2Id, setSubstitute2Id] = useState("");
  const [substitute3Id, setSubstitute3Id] = useState("");
  const [branchHeadOpinion, setBranchHeadOpinion] = useState("");

  // Selected employee — drives gender/employee_type-dependent UI (D3)
  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null;
  const empGender = selectedEmployee?.gender ?? null;
  const empType = selectedEmployee?.employee_type ?? null;
  const isFemaleMaternity = empGender === "หญิง" || empGender === "female";
  const isMaleMaternity = empGender === "ชาย" || empGender === "male";

  // Working days preview
  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [wdLoading, setWdLoading] = useState(false);

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const typeName = selectedType?.name?.toLowerCase() ?? "";
  const isMaternity = typeName.includes("คลอด") || typeName.includes("maternity");
  const isVacation = typeName.includes("พักผ่อน") || typeName.includes("vacation");
  const isSick = typeName.includes("ป่วย") || typeName.includes("sick");

  function calculateDays(): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diff, 0);
  }

  // Fetch working days preview when dates change
  const fetchWorkingDays = useCallback(
    async (s: string, e: string) => {
      if (!s || !e) { setWorkingDays(null); return; }
      setWdLoading(true);
      try {
        const result = await previewWorkingDays(s, e);
        setWorkingDays(result.workingDays);
      } catch {
        setWorkingDays(null);
      } finally {
        setWdLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (startDate && endDate) {
      fetchWorkingDays(startDate, endDate);
    } else {
      setWorkingDays(null);
    }
  }, [startDate, endDate, fetchWorkingDays]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!employeeId) { setError("กรุณาเลือกพนักงาน"); return; }
    if (!leaveTypeId) { setError("กรุณาเลือกประเภทการลา"); return; }
    if (!startDate || !endDate) { setError("กรุณาระบุวันที่เริ่มต้นและสิ้นสุด"); return; }

    const totalDays = calculateDays();
    if (totalDays <= 0) { setError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น"); return; }

    startTransition(async () => {
      try {
        await createLeaveRequestByHr(employeeId, {
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason: reason || null,
          contact_number: contactNumber || null,
          medical_cert_url: medicalCertPath || null,
          expected_delivery_date: isMaternity ? expectedDeliveryDate || null : null,
          vacation_details: isVacation ? {
            // accumulated/annual days are read from leave_balances on the
            // server (B2 single source of truth).
            substitute_1_id: substitute1Id || null,
            substitute_2_id: substitute2Id || null,
            substitute_3_id: substitute3Id || null,
            branch_head_opinion: branchHeadOpinion || null,
          } : undefined,
        });

        // document_tracking row is created inside createLeaveRequestByHr
        // (W2b) — no separate call here (avoids a duplicate row).

        toast.success("บันทึกใบลาเรียบร้อยแล้ว");
        router.push("/dashboard/hr/leaves");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Employee selection */}
      <div className="space-y-2">
        <Label>พนักงาน <span className="text-destructive">*</span></Label>
        <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")} disabled={isPending}>
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

      {/* Leave type */}
      <div className="space-y-2">
        <Label>ประเภทการลา <span className="text-destructive">*</span></Label>
        <Select value={leaveTypeId} onValueChange={(v) => setLeaveTypeId(v ?? "")} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="เลือกประเภทการลา..." />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((lt) => (
              <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">เหตุผล</Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="ระบุเหตุผลการลา"
          disabled={isPending}
        />
      </div>

      {/* Contact */}
      <div className="space-y-2">
        <Label htmlFor="contact">เบอร์ติดต่อ</Label>
        <Input
          id="contact"
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          placeholder="เบอร์โทรศัพท์ที่ติดต่อได้"
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

      {startDate && endDate && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <span>
            จำนวนวันลา:{" "}
            <span className="font-bold">{calculateDays()} วันปฏิทิน</span>
            {workingDays !== null && (
              <span className="text-muted-foreground ml-1.5">
                ({wdLoading ? (
                  <Loader2 className="inline h-3 w-3 animate-spin" />
                ) : (
                  <span className="font-semibold text-foreground">{workingDays} วันทำการ</span>
                )})
              </span>
            )}
            {wdLoading && workingDays === null && (
              <Loader2 className="inline h-3 w-3 animate-spin ml-2" />
            )}
          </span>
        </div>
      )}

      {/* Maternity-specific — D3: gender-aware */}
      {isMaternity && employeeId && !isFemaleMaternity && !isMaleMaternity && (
        <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            พนักงานคนนี้ยังไม่ได้ระบุเพศในโปรไฟล์ — กรุณาให้พนักงานอัปเดตโปรไฟล์ก่อนยื่นลาคลอด
          </span>
        </div>
      )}
      {isMaternity && isFemaleMaternity && (
        <div className="space-y-2 p-4 border rounded-lg bg-pink-50/50">
          <p className="text-sm font-medium">ลาคลอด (หญิง) — ≤ 90 วันปฏิทิน</p>
          <Label htmlFor="deliveryDate">วันที่คาดว่าจะคลอด</Label>
          <Input
            id="deliveryDate"
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}
      {isMaternity && isMaleMaternity && (
        <div className="space-y-2 p-4 border rounded-lg bg-sky-50">
          <p className="text-sm font-medium">ลาดูแลภรรยาคลอด (ชาย) — ≤ 15 วันทำการ</p>
          <Label htmlFor="deliveryDate">วันที่คาดว่าจะคลอด (ถ้าทราบ)</Label>
          <Input
            id="deliveryDate"
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {/* Vacation-specific — D3: cap label from employee_type, balance pulled
          server-side (B2). No more manual accumulated/annual inputs. */}
      {isVacation && (
        <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
          <p className="text-sm font-medium">รายละเอียดลาพักผ่อน</p>
          {employeeId && (
            <div className="rounded-md border border-sky-200 bg-white/60 p-2 text-xs text-sky-900 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {vacationCapLabel(empType)} · วันสะสมและสิทธิ์ประจำปีถูกอ่านจากระบบโดยอัตโนมัติ
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label>ผู้ปฏิบัติงานแทน (สูงสุด 3 คน)</Label>
            <Select value={substitute1Id} onValueChange={(v) => setSubstitute1Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติงานแทนคนที่ 1..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ระบุ</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={substitute2Id} onValueChange={(v) => setSubstitute2Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติงานแทนคนที่ 2..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ระบุ</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={substitute3Id} onValueChange={(v) => setSubstitute3Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติงานแทนคนที่ 3..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่ระบุ</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opinion">ความเห็นหัวหน้าสาขา</Label>
            <Input
              id="opinion"
              value={branchHeadOpinion}
              onChange={(e) => setBranchHeadOpinion(e.target.value)}
              placeholder="ความเห็นหัวหน้าสาขาวิชา"
              disabled={isPending}
            />
          </div>
        </div>
      )}

      {/* Medical cert upload (Sick leave or maternity) */}
      {(isSick || isMaternity) && (
        <div className="p-4 border rounded-lg bg-amber-50/50 space-y-2">
          {isSick && workingDays !== null && workingDays > 2 && (
            <p className="text-xs text-amber-800 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              ลาป่วยเกิน 2 วันทำการ ต้องแนบใบรับรองแพทย์
            </p>
          )}
          <FileUpload
            pathPrefix={`leaves/${employeeId || "unknown"}`}
            onUploaded={setMedicalCertPath}
            label={isSick ? "แนบใบรับรองแพทย์ (บังคับถ้าเกิน 2 วันทำการ)" : "แนบใบรับรองแพทย์"}
            disabled={isPending}
          />
        </div>
      )}

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
          บันทึกใบลา
        </Button>
      </div>
    </form>
  );
}
