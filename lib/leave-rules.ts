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
import { currentFiscalYear } from "@/lib/date-ranges";
import { calculateWorkingDays, calculateCalendarDays } from "@/lib/working-days";

// ─── Status contract (W0) ──────────────────────────────────

/**
 * Statuses that COUNT toward leave usage / quota (reserve-on-submit model).
 * A request consumes balance from submission until it is rejected/cancelled.
 * Used by getUsedLeaveDays + reports + availability checks — the single
 * source of truth for "is this request consuming quota".
 */
export const COMMITTED_LEAVE_STATUSES = [
  "pending",
  "awaiting_director",
  "awaiting_dean",
  "approved",
  "awaiting_university",
  "completed",
] as const;

export type LeaveStatus =
  | (typeof COMMITTED_LEAVE_STATUSES)[number]
  | "rejected"
  | "cancelled";

/** Display stage derived from leave_requests.status (Thai label + step index). */
export function getLeaveStage(status: string): { label: string; step: number } {
  switch (status) {
    case "pending":
      return { label: "รอตรวจสอบ", step: 0 };
    case "awaiting_director":
      return { label: "รอผู้อำนวยการเซ็น", step: 1 };
    case "awaiting_dean":
      return { label: "รอคณบดีเซ็น", step: 2 };
    case "approved":
      return { label: "อนุมัติแล้ว (คณบดีลงนาม)", step: 3 };
    case "awaiting_university":
      return { label: "ส่งมหาวิทยาลัย — รออธิการบดีลงนาม", step: 4 };
    case "completed":
      return { label: "เสร็จสิ้น", step: 5 };
    case "rejected":
      return { label: "ไม่อนุมัติ", step: -1 };
    case "cancelled":
      return { label: "ยกเลิก", step: -1 };
    default:
      return { label: status, step: 0 };
  }
}

// ─── Vacation accumulation cap by employee_type ────────────

/**
 * Max carry-over days for vacation leave — read from the
 * employee_types table (managed by HR in master-data, M3).
 *
 * Replaces the previous hardcoded switch which silently returned 0 for
 * any name that didn't match exactly (e.g. "พนักงานมหาวิทยาลัย(สายสนับสนุน)"
 * lost its accumulation).
 */
export async function getVacationAccumulationCap(
  supabase: SupabaseClient<Database>,
  employeeType: string | null,
): Promise<number> {
  if (!employeeType) return 0;
  const { data } = await supabase
    .from("employee_types")
    .select("vacation_accumulation_cap")
    .eq("name", employeeType)
    .maybeSingle();
  return data?.vacation_accumulation_cap ?? 0;
}

// ─── Get used leave days for current FY (committed statuses) ────

/**
 * Sum working_days from committed leave_requests (reserve-on-submit: every
 * non-rejected/cancelled request consumes quota) for a given employee,
 * leave type, and fiscal year range.  Falls back to `total_days` if
 * `working_days` is null (backward compat for old records).
 *
 * Pass `excludeRequestId` to omit a specific request (e.g. when validating
 * an edit so the request doesn't count against itself).
 */
export async function getUsedLeaveDays(
  supabase: SupabaseClient<Database>,
  employeeId: string,
  leaveTypeId: string,
  fyStart: string,
  fyEnd: string,
  excludeRequestId?: string,
): Promise<number> {
  let query = supabase
    .from("leave_requests")
    .select("working_days, total_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .in("status", COMMITTED_LEAVE_STATUSES)
    .gte("start_date", fyStart)
    .lte("start_date", fyEnd);
  if (excludeRequestId) query = query.neq("id", excludeRequestId);
  const { data, error } = await query;

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
  // 1. Fetch leave type code + name + entitlement (max_days_per_year is the
  //    FY cap HR sets in master-data — M1)
  const { data: lt } = await supabase
    .from("leave_types")
    .select("code, name, max_days_per_year")
    .eq("id", leaveTypeId)
    .single();
  const code = lt?.code ?? null;
  const leaveTypeName = lt?.name ?? "ลา";
  const maxDays = lt?.max_days_per_year ?? 0;

  // Policy thresholds (M5) — HR-configurable in master-data
  const { data: policyRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "leave_policy")
    .maybeSingle();
  const policy = (policyRow?.value as { sick_cert_threshold_working_days?: number } | null) ?? null;
  const certThreshold = policy?.sick_cert_threshold_working_days ?? 2;

  // 2. Fetch employee profile (gender, employee_type, full_name)
  const { data: emp } = await supabase
    .from("profiles")
    .select("gender, employee_type, full_name")
    .eq("id", employeeId)
    .single();
  const employeeName = emp?.full_name ?? "พนักงาน";

  // 3. Calculate working days
  const workingDays = await calculateWorkingDays(supabase, startDate, endDate);

  // 4. Current balance — the authoritative usage source (W0; fixes the
  //    dual-source bug where opening-balance imports have no request rows).
  //    balance.used_days includes imported opening balances + every reserved
  //    request (reserve-on-submit). The request being created is not reserved
  //    yet, so it is not double-counted here.
  const fy = currentFiscalYear();
  const { data: balance } = await supabase
    .from("leave_balances")
    .select("used_days, total_days, accumulated_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("fiscal_year", fy)
    .maybeSingle();
  const usedDays = balance?.used_days ?? 0;

  // 6. Validate based on leave type code
  switch (code) {
    case "SICK": {
      if (workingDays > maxDays) {
        throw new Error(`ลาป่วยต่อครั้งไม่เกิน ${maxDays} วันทำการ`);
      }
      if (usedDays + workingDays > maxDays) {
        throw new Error(
          `ลาป่วยเกินสิทธิ์ปีงบประมาณ (ใช้ไป ${usedDays} วัน + ครั้งนี้ ${workingDays} วัน เกิน ${maxDays} วัน)`,
        );
      }
      if (workingDays > certThreshold && !medicalCertUrl) {
        throw new Error(`ลาป่วยเกิน ${certThreshold} วันทำการต้องแนบใบรับรองแพทย์`);
      }
      break;
    }

    case "PERSONAL": {
      if (usedDays + workingDays > maxDays) {
        throw new Error(
          `ลากิจเกินสิทธิ์ปีงบประมาณ (ใช้ไป ${usedDays} วัน + ครั้งนี้ ${workingDays} วัน เกิน ${maxDays} วัน)`,
        );
      }
      break;
    }

    case "VACATION": {
      // Uses the balance fetched above (single source) +
      // max_days_per_year from leave_types (M1) instead of hardcoded 10.
      const annualDays = maxDays;
      const accumulated = balance?.accumulated_days ?? 0;
      const entitlement = balance?.total_days ?? annualDays;
      const cap = await getVacationAccumulationCap(supabase, emp?.employee_type ?? null);

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
