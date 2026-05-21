/**
 * Leave business-rule validation — pure logic + DB reads.
 *
 * Extracted from `leave-actions.ts` so that:
 *   1. Rules can be unit-tested without the "use server" boundary
 *   2. `leave-actions.ts` stays focused on the server-action pattern
 *      (auth → validate → mutate → notify → revalidate)
 *
 * None of these functions touches auth or revalidation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { currentFiscalYear, fiscalYearRange } from "@/lib/date-ranges";
import { calculateWorkingDays, calculateCalendarDays } from "@/lib/working-days";

// ─── Vacation accumulation cap by employee_type ────────────

/** Max carry-over days for vacation leave by civil-service category. */
export function getVacationAccumulationCap(employeeType: string | null): number {
  switch (employeeType) {
    case "ข้าราชการ":
      return 30;
    case "พนักงานมหาวิทยาลัย":
      return 20;
    case "พนักงานราชการ":
      return 15;
    default:
      return 0; // ลูกจ้างชั่วคราว, ลูกจ้างประจำ, etc. — ไม่สะสม
  }
}

// ─── Get used leave days for current FY (approved only) ────

/**
 * Sum working_days from approved leave_requests for a given employee,
 * leave type, and fiscal year range.  Falls back to `total_days` if
 * `working_days` is null (backward compat for old records).
 */
export async function getUsedLeaveDays(
  supabase: SupabaseClient<Database>,
  employeeId: string,
  leaveTypeId: string,
  fyStart: string,
  fyEnd: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("working_days, total_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("status", "approved")
    .gte("start_date", fyStart)
    .lte("start_date", fyEnd);

  if (error) {
    console.warn("[leave-rules] getUsedLeaveDays failed:", error.message);
    return 0;
  }

  return (data ?? []).reduce((sum, r) => sum + (r.working_days ?? r.total_days), 0);
}

// ─── Enforce rules result type ─────────────────────────────

export interface EnforceRulesResult {
  /** Effective days to store in `leave_requests.working_days`.
   *  For female maternity this is **calendar days** (not working days)
   *  because maternity counts weekends & holidays per Thai law. */
  workingDays: number;
  /** Leave type name — returned so callers can reuse it for notifications
   *  without an extra query. */
  leaveTypeName: string;
  /** Employee full name — same motivation. */
  employeeName: string;
}

// ─── Main validation entry point ───────────────────────────

/**
 * Enforce business rules for all 4 leave types.
 *
 * Calculates working days and validates caps, medical-cert requirements,
 * gender restrictions, and FY accumulation.
 *
 * @throws Thai error message when a rule is violated.
 * @returns `EnforceRulesResult` for the caller to insert and use in notifications.
 */
export async function enforceLeaveTypeRules(
  supabase: SupabaseClient<Database>,
  leaveTypeId: string,
  employeeId: string,
  startDate: string,
  endDate: string,
  totalDays: number,
  medicalCertUrl: string | null | undefined,
  expectedDeliveryDate: string | null | undefined,
): Promise<EnforceRulesResult> {
  // 1. Fetch leave type code + name
  const { data: lt } = await supabase
    .from("leave_types")
    .select("code, name")
    .eq("id", leaveTypeId)
    .single();
  const code = lt?.code ?? null;
  const leaveTypeName = lt?.name ?? "ลา";

  // 2. Fetch employee profile (gender, employee_type, full_name)
  const { data: emp } = await supabase
    .from("profiles")
    .select("gender, employee_type, full_name")
    .eq("id", employeeId)
    .single();
  const employeeName = emp?.full_name ?? "พนักงาน";

  // 3. Calculate working days
  const workingDays = await calculateWorkingDays(supabase, startDate, endDate);

  // 4. Fiscal year range for used-days query
  const fy = currentFiscalYear();
  const { start: fyStart, end: fyEnd } = fiscalYearRange(fy);

  // 5. Get used days this FY (approved only)
  const usedDays = await getUsedLeaveDays(supabase, employeeId, leaveTypeId, fyStart, fyEnd);

  // 6. Validate based on leave type code
  switch (code) {
    case "SICK": {
      if (workingDays > 30) {
        throw new Error("ลาป่วยต่อครั้งไม่เกิน 30 วันทำการ");
      }
      if (usedDays + workingDays > 30) {
        throw new Error(
          `ลาป่วยเกินสิทธิ์ปีงบประมาณ (ใช้ไป ${usedDays} วัน + ครั้งนี้ ${workingDays} วัน เกิน 30 วัน)`,
        );
      }
      if (workingDays > 2 && !medicalCertUrl) {
        throw new Error("ลาป่วยเกิน 2 วันทำการต้องแนบใบรับรองแพทย์");
      }
      break;
    }

    case "PERSONAL": {
      if (usedDays + workingDays > 10) {
        throw new Error(
          `ลากิจเกินสิทธิ์ปีงบประมาณ (ใช้ไป ${usedDays} วัน + ครั้งนี้ ${workingDays} วัน เกิน 10 วัน)`,
        );
      }
      break;
    }

    case "VACATION": {
      const { data: balance } = await supabase
        .from("leave_balances")
        .select("total_days, accumulated_days")
        .eq("employee_id", employeeId)
        .eq("leave_type_id", leaveTypeId)
        .eq("fiscal_year", fy)
        .maybeSingle();

      const annualDays = 10;
      const accumulated = balance?.accumulated_days ?? 0;
      const entitlement = balance?.total_days ?? annualDays;
      const cap = getVacationAccumulationCap(emp?.employee_type ?? null);

      if (usedDays + workingDays > entitlement) {
        throw new Error(
          `ลาพักผ่อนเกินสิทธิ์ (สิทธิ์ ${annualDays} + สะสม ${accumulated} = ${entitlement} วัน, ` +
            `ใช้ไป ${usedDays} + ครั้งนี้ ${workingDays} เกินสิทธิ์${cap > 0 ? ` สูงสุดสะสม ${cap} วัน` : " ประเภทนี้ไม่มีสิทธิ์สะสม"})`,
        );
      }
      break;
    }

    case "MATERNITY": {
      const gender = emp?.gender ?? null;

      // gender เก็บเป็นภาษาไทย: "ชาย" / "หญิง" / "ไม่ระบุ"
      // (คง "female"/"male" ไว้รองรับข้อมูลเก่า backward-compat)
      const isFemale = gender === "หญิง" || gender === "female";
      const isMale = gender === "ชาย" || gender === "male";

      if (!isFemale && !isMale) {
        // ครอบคลุม null, "ไม่ระบุ", และค่าอื่น ๆ ที่ไม่รู้จัก
        throw new Error("กรุณาอัปเดตข้อมูลเพศในโปรไฟล์ก่อนยื่นลาคลอด");
      }

      if (isFemale) {
        // เพศหญิง: ≤ 90 วันปฏิทิน (นับรวมวันหยุด — ตามกฎหมายลาคลอด)
        const calendarDays = calculateCalendarDays(startDate, endDate);
        if (calendarDays > 90) {
          throw new Error(`ลาคลอด (หญิง) ไม่เกิน 90 วันปฏิทิน (ครั้งนี้ ${calendarDays} วัน)`);
        }
        if (!expectedDeliveryDate) {
          throw new Error("กรุณาระบุวันที่กำหนดคลอด");
        }
        // NOTE: For female maternity, `workingDays` stores calendar days
        // (not Mon–Fri working days) because Thai maternity leave counts
        // every day including weekends and holidays.
        return { workingDays: calendarDays, leaveTypeName, employeeName };
      } else {
        // เพศชาย: ≤ 15 วันทำการ (ลาดูแลภรรยาคลอด)
        if (workingDays > 15) {
          throw new Error(`ลาคลอด (ชาย/ดูแลภรรยาคลอด) ไม่เกิน 15 วันทำการ (ครั้งนี้ ${workingDays} วัน)`);
        }
      }
      break;
    }

    default:
      // Unknown leave type code — no additional rules
      break;
  }

  return { workingDays, leaveTypeName, employeeName };
}
