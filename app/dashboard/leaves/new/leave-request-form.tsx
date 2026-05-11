"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLeaveRequest, type CreateLeaveRequestInput } from "@/lib/actions/leave-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LeaveType } from "@/types/supabase";

interface Props {
  leaveTypes: LeaveType[];
  employees: { id: string; full_name: string; email: string }[];
}

export function LeaveRequestForm({ leaveTypes, employees }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  // Vacation-specific
  const [accumulatedDays, setAccumulatedDays] = useState("");
  const [annualDays, setAnnualDays] = useState("");
  const [substitute1Id, setSubstitute1Id] = useState("");
  const [substitute2Id, setSubstitute2Id] = useState("");
  const [substitute3Id, setSubstitute3Id] = useState("");
  const [branchHeadOpinion, setBranchHeadOpinion] = useState("");

  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const typeName = selectedType?.name?.toLowerCase() ?? "";

  const isSick = typeName.includes("ป่วย") || typeName.includes("sick");
  const isMaternity = typeName.includes("คลอด") || typeName.includes("maternity");
  const isVacation = typeName.includes("พักผ่อน") || typeName.includes("vacation");

  function calculateDays(): number {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }

  const totalDays = calculateDays();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!leaveTypeId || !startDate || !endDate) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (totalDays <= 0) {
      setError("วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่ม");
      return;
    }

    const input: CreateLeaveRequestInput = {
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      reason: reason || null,
      contact_number: contactNumber || null,
      submission_channel: "digital",
    };

    if (isSick) {
      // Medical cert URL handled separately (file upload in future)
    }

    if (isMaternity) {
      input.expected_delivery_date = expectedDeliveryDate || null;
    }

    if (isVacation) {
      input.vacation_details = {
        accumulated_days: Number(accumulatedDays) || 0,
        annual_days: Number(annualDays) || 0,
        substitute_1_id: substitute1Id || null,
        substitute_2_id: substitute2Id || null,
        substitute_3_id: substitute3Id || null,
        branch_head_opinion: branchHeadOpinion || null,
      };
    }

    startTransition(async () => {
      try {
        await createLeaveRequest(input);
        toast.success("ยื่นคำขอลาเรียบร้อยแล้ว");
        router.push("/dashboard/leaves");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
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

      {/* Leave Type Selection */}
      <div className="space-y-2">
        <Label>ประเภทการลา *</Label>
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
        <p className="text-sm text-muted-foreground">จำนวนวันลา: <strong>{totalDays}</strong> วัน</p>
      )}

      {/* Reason (required for sick & personal) */}
      <div className="space-y-2">
        <Label>เหตุผล {(isSick || (!isMaternity && !isVacation)) ? "*" : ""}</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="ระบุเหตุผลการลา..."
          disabled={isPending}
          required={isSick || (!isMaternity && !isVacation && !!leaveTypeId)}
        />
      </div>

      {/* Contact Number */}
      <div className="space-y-2">
        <Label>เบอร์ติดต่อระหว่างลา</Label>
        <Input
          value={contactNumber}
          onChange={(e) => setContactNumber(e.target.value)}
          placeholder="0812345678"
          disabled={isPending}
        />
      </div>

      {/* Maternity-specific: Expected Delivery Date */}
      {isMaternity && (
        <div className="space-y-2">
          <Label>วันที่คาดว่าจะคลอด</Label>
          <Input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {/* Vacation-specific fields */}
      {isVacation && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">ข้อมูลเพิ่มเติมสำหรับลาพักผ่อน</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>วันสะสมจากปีก่อน</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={accumulatedDays}
                onChange={(e) => setAccumulatedDays(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>วันลาพักผ่อนประจำปี</Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={annualDays}
                onChange={(e) => setAnnualDays(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>ผู้ปฏิบัติหน้าที่แทนคนที่ 1</Label>
            <Select value={substitute1Id} onValueChange={(v) => setSubstitute1Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติแทน..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ผู้ปฏิบัติหน้าที่แทนคนที่ 2</Label>
            <Select value={substitute2Id} onValueChange={(v) => setSubstitute2Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติแทน (ถ้ามี)..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ผู้ปฏิบัติหน้าที่แทนคนที่ 3</Label>
            <Select value={substitute3Id} onValueChange={(v) => setSubstitute3Id(v ?? "")} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกผู้ปฏิบัติแทน (ถ้ามี)..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ความเห็นหัวหน้าสาขา</Label>
            <Input
              value={branchHeadOpinion}
              onChange={(e) => setBranchHeadOpinion(e.target.value)}
              placeholder="ความเห็นของหัวหน้าสาขา (ถ้ามี)"
              disabled={isPending}
            />
          </div>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending || !leaveTypeId || !startDate || !endDate}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        ส่งคำขอลา
      </Button>
    </form>
  );
}
