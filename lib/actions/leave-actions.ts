"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "./notification-actions";
import { UUID_RE, validateRequestDates, validateEmployeeExists, validateTextField } from "./validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { currentFiscalYear } from "@/lib/date-ranges";
import { calculateWorkingDays, calculateCalendarDays } from "@/lib/working-days";
import { enforceLeaveTypeRules, getVacationAccumulationCap } from "@/lib/leave-rules";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ─── Auth helpers ──────────────────────────────────────────

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized: Please log in");
  return user;
}

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single();
  return profile;
}

// ─── Toggle helper (reuses existing client) ────────────────

async function isLeaveOnlineEnabled(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "leave_online_submission_enabled")
    .maybeSingle();

  if (!data) return true; // default: enabled
  const val = data.value as { enabled?: boolean } | null;
  return val?.enabled !== false;
}

// ═══════════════════════════════════════════════════════════
//  Reads
// ═══════════════════════════════════════════════════════════

export async function getLeaveTypes() {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("leave_types")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลประเภทการลาได้");
  return data;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 10;

export async function getMyLeaveRequests(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name)
    `, { count: "exact" })
    .eq("employee_id", user.id);

  if (params?.status && params.status !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("status", params.status as any);
  }

  if (params?.search) {
    query = query.or(`reason.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export async function getMyLeaveBalances() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const currentYear = currentFiscalYear();

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      leave_type:leave_types(name)
    `)
    .eq("employee_id", user.id)
    .eq("fiscal_year", currentYear);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลวันลาคงเหลือได้");
  return data;
}

export async function getAllLeaveRequests(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name),
      employee:profiles!leave_requests_employee_id_fkey(full_name, email, department_id)
    `, { count: "exact" });

  if (params?.status && params.status !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("status", params.status as any);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาทั้งหมดได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export async function getLeaveRequestById(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(id, name, max_days_per_year),
      employee:profiles!leave_requests_employee_id_fkey(id, full_name, email, position_title, department_id),
      approver:profiles!leave_requests_approver_id_fkey(id, full_name, email),
      vacation_details:leave_vacation_details(
        accumulated_days, annual_days, branch_head_opinion,
        substitute_1:profiles!leave_vacation_details_substitute_1_id_fkey(id, full_name),
        substitute_2:profiles!leave_vacation_details_substitute_2_id_fkey(id, full_name),
        substitute_3:profiles!leave_vacation_details_substitute_3_id_fkey(id, full_name)
      )
    `)
    .eq("id", requestId)
    .single();

  if (error || !data) throw new Error("ไม่พบข้อมูลคำขอลา");

  const isOwner = data.employee_id === user.id;
  const isPrivileged = profile && ["hr", "admin", "manager"].includes(profile.role);
  if (!isOwner && !isPrivileged) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return data;
}

export async function getEmployeesForSelection() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("status", "approved")
    .order("full_name");

  if (error) throw new Error("ไม่สามารถดึงรายชื่อพนักงานได้");
  return data;
}

/**
 * Calculate working days and calendar days for a date range.
 * Used by the leave request form to show a real-time preview.
 */
export async function previewWorkingDays(
  startDate: string,
  endDate: string,
): Promise<{ workingDays: number; calendarDays: number }> {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const calendarDays = calculateCalendarDays(startDate, endDate);
  const workingDays = await calculateWorkingDays(supabase, startDate, endDate);

  return { workingDays, calendarDays };
}

// ═══════════════════════════════════════════════════════════
//  Mutations — Create
// ═══════════════════════════════════════════════════════════

export interface CreateLeaveRequestInput {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  contact_number: string | null;
  medical_cert_url?: string | null;
  expected_delivery_date?: string | null;
  submission_channel: "digital" | "paper";
  // Vacation-specific fields
  vacation_details?: {
    accumulated_days: number;
    annual_days: number;
    substitute_1_id: string | null;
    substitute_2_id: string | null;
    substitute_3_id: string | null;
    branch_head_opinion: string | null;
  };
}

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  if (!UUID_RE.test(input.leave_type_id)) {
    throw new Error("รหัสประเภทลาไม่ถูกต้อง");
  }
  validateRequestDates(input.start_date, input.end_date, input.total_days);

  const sanitizedReason = validateTextField(input.reason, "เหตุผล", 1000);
  const sanitizedContact = validateTextField(input.contact_number, "เบอร์ติดต่อ", 20);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  // ── Digital-channel: check online toggle ──
  if (input.submission_channel === "digital") {
    const toggleEnabled = await isLeaveOnlineEnabled(supabase);
    if (!toggleEnabled) {
      throw new Error("ระบบยื่นลาออนไลน์ปิดอยู่ กรุณาติดต่อ HR เพื่อยื่นแบบเอกสาร");
    }
  }

  // ── Enforce business rules + calculate working days ──
  const { workingDays, leaveTypeName, employeeName } = await enforceLeaveTypeRules(
    supabase, input.leave_type_id, user.id,
    input.start_date, input.end_date, input.total_days,
    input.medical_cert_url, input.expected_delivery_date,
  );

  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: user.id,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      working_days: workingDays,
      reason: sanitizedReason,
      contact_number: sanitizedContact,
      medical_cert_url: input.medical_cert_url ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      submission_channel: input.submission_channel,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[leave-actions] Failed to create leave request:", error);
    throw new Error("ไม่สามารถส่งคำขอลาได้");
  }

  if (input.vacation_details && request) {
    const sanitizedOpinion = validateTextField(input.vacation_details.branch_head_opinion, "ความเห็นหัวหน้า", 500);
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: input.vacation_details.accumulated_days,
        annual_days: input.vacation_details.annual_days,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: sanitizedOpinion,
      });

    if (vacError) {
      console.error("[leave-actions] Failed to insert vacation details:", vacError);
    }
  }

  // ── Notify HR/Manager (reuse data from enforceLeaveTypeRules) ──
  const notifMsg = `มีคำขอ${leaveTypeName}ใหม่จาก ${employeeName} (${workingDays} วัน) รอการอนุมัติ`;

  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"]);
  if (hrUsers) {
    for (const hr of hrUsers) {
      await createNotificationInternal(supabase, hr.id, "new_leave_request", notifMsg);
    }
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
  return { success: true, id: request.id };
}

export async function createLeaveRequestByHr(
  employeeId: string,
  input: Omit<CreateLeaveRequestInput, "submission_channel">,
) {
  if (!UUID_RE.test(input.leave_type_id)) {
    throw new Error("รหัสประเภทลาไม่ถูกต้อง");
  }
  validateRequestDates(input.start_date, input.end_date, input.total_days);

  const sanitizedReason = validateTextField(input.reason, "เหตุผล", 1000);
  const sanitizedContact = validateTextField(input.contact_number, "เบอร์ติดต่อ", 20);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  await validateEmployeeExists(supabase, employeeId);

  // ── Enforce business rules (no toggle check — paper channel) ──
  const { workingDays, leaveTypeName, employeeName } = await enforceLeaveTypeRules(
    supabase, input.leave_type_id, employeeId,
    input.start_date, input.end_date, input.total_days,
    input.medical_cert_url, input.expected_delivery_date,
  );

  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: employeeId,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      working_days: workingDays,
      reason: sanitizedReason,
      contact_number: sanitizedContact,
      medical_cert_url: input.medical_cert_url ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      submission_channel: "paper",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[leave-actions] HR create leave failed:", error);
    throw new Error("ไม่สามารถส่งคำขอลาแทนพนักงานได้");
  }

  if (input.vacation_details && request) {
    const sanitizedOpinion = validateTextField(input.vacation_details.branch_head_opinion, "ความเห็นหัวหน้า", 500);
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: input.vacation_details.accumulated_days,
        annual_days: input.vacation_details.annual_days,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: sanitizedOpinion,
      });

    if (vacError) {
      console.error("[leave-actions] HR vacation details insert failed:", vacError);
    }
  }

  // ── Notify HR/Admin (exclude the HR who submitted) ──
  const notifMsg = `มีคำขอ${leaveTypeName}ใหม่จาก ${employeeName} (${workingDays} วัน · กระดาษ) รอการอนุมัติ`;
  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"])
    .neq("id", user.id);
  if (hrUsers) {
    for (const hr of hrUsers) {
      await createNotificationInternal(supabase, hr.id, "new_leave_request", notifMsg);
    }
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
  return { success: true, id: request.id };
}

// ═══════════════════════════════════════════════════════════
//  Mutations — Approve / Reject / Cancel
// ═══════════════════════════════════════════════════════════

export async function approveLeaveRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      approver_id: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("employee_id, leave_type_id, working_days, total_days")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถอนุมัติคำขอลาได้ (อาจถูกดำเนินการแล้ว)");

  // ── Update leave_balances: add used_days ──
  const daysToAdd = updated.working_days ?? updated.total_days;
  const fy = currentFiscalYear();

  try {
    const { data: balance } = await supabase
      .from("leave_balances")
      .select("id, used_days, total_days")
      .eq("employee_id", updated.employee_id)
      .eq("leave_type_id", updated.leave_type_id)
      .eq("fiscal_year", fy)
      .maybeSingle();

    if (balance) {
      const newUsed = (balance.used_days ?? 0) + daysToAdd;
      await supabase
        .from("leave_balances")
        .update({
          used_days: newUsed,
          remaining_days: Math.max(0, balance.total_days - newUsed),
          updated_at: new Date().toISOString(),
        })
        .eq("id", balance.id);
    } else {
      // Auto-create balance row — use leave_type max_days as default
      const { data: lt } = await supabase
        .from("leave_types")
        .select("max_days_per_year")
        .eq("id", updated.leave_type_id)
        .single();
      const totalEntitlement = lt?.max_days_per_year ?? 0;

      await supabase.from("leave_balances").insert({
        employee_id: updated.employee_id,
        leave_type_id: updated.leave_type_id,
        fiscal_year: fy,
        total_days: totalEntitlement,
        used_days: daysToAdd,
        remaining_days: Math.max(0, totalEntitlement - daysToAdd),
        accumulated_days: 0,
      });
    }
  } catch (balanceErr) {
    // Non-blocking: log but don't fail the approval
    console.error("[leave-actions] Failed to update leave_balances:", balanceErr);
  }

  // ── Notification with leave type name ──
  const { data: ltInfo } = await supabase
    .from("leave_types").select("name").eq("id", updated.leave_type_id).single();
  const ltName = ltInfo?.name ?? "ลา";
  const notifMsg = `คำขอ${ltName}ของคุณได้รับการอนุมัติแล้ว (${daysToAdd} วัน)`;

  await logAudit(supabase, user.id, "approve_leave", "leave_request", requestId);
  await createNotificationInternal(supabase, updated.employee_id, "leave_approved", notifMsg);

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

export async function rejectLeaveRequest(requestId: string, reason?: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({
      status: "rejected" as const,
      approver_id: user.id,
      ...(reason ? { reason } : {}),
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("employee_id, leave_type_id")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถปฏิเสธคำขอลาได้ (อาจถูกดำเนินการแล้ว)");

  const { data: ltInfo } = await supabase
    .from("leave_types").select("name").eq("id", updated.leave_type_id).single();
  const ltName = ltInfo?.name ?? "ลา";

  const rejectMsg = reason
    ? `คำขอ${ltName}ของคุณไม่ได้รับการอนุมัติ เหตุผล: ${reason}`
    : `คำขอ${ltName}ของคุณไม่ได้รับการอนุมัติ`;

  await logAudit(supabase, user.id, "reject_leave", "leave_request", requestId);
  await createNotificationInternal(supabase, updated.employee_id, "leave_rejected", rejectMsg);

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

export async function cancelLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  // Read current status so we know whether to restore balance
  const { data: req } = await supabase
    .from("leave_requests")
    .select("id, status, employee_id, leave_type_id, working_days, total_days")
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .single();

  if (!req) throw new Error("ไม่พบคำขอลานี้");
  if (req.status !== "pending" && req.status !== "approved") {
    throw new Error("ยกเลิกได้เฉพาะคำขอที่อยู่ในสถานะรออนุมัติหรืออนุมัติแล้วเท่านั้น");
  }

  const wasPreviouslyApproved = req.status === "approved";

  // Atomic: only cancel if status hasn't changed since our read
  const { data: cancelled, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .eq("status", req.status)           // ← guard against race condition
    .select("id")
    .single();

  if (error || !cancelled) {
    throw new Error("ไม่สามารถยกเลิกคำขอลาได้ (สถานะอาจเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า)");
  }

  // ── Restore leave_balances if the request was approved ──
  if (wasPreviouslyApproved) {
    const daysToRestore = req.working_days ?? req.total_days;
    const fy = currentFiscalYear();

    try {
      const { data: balance } = await supabase
        .from("leave_balances")
        .select("id, used_days, total_days")
        .eq("employee_id", req.employee_id)
        .eq("leave_type_id", req.leave_type_id)
        .eq("fiscal_year", fy)
        .maybeSingle();

      if (balance) {
        const newUsed = Math.max(0, (balance.used_days ?? 0) - daysToRestore);
        await supabase
          .from("leave_balances")
          .update({
            used_days: newUsed,
            remaining_days: Math.max(0, balance.total_days - newUsed),
            updated_at: new Date().toISOString(),
          })
          .eq("id", balance.id);
      }
    } catch (balanceErr) {
      console.error("[leave-actions] Failed to restore leave_balances:", balanceErr);
    }
  }

  await logAudit(supabase, user.id, "cancel_leave", "leave_request", requestId, {
    was_approved: wasPreviouslyApproved,
  });

  // ── Notify HR/Admin about cancellation ──
  try {
    const [{ data: empProfile }, { data: ltInfo }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", req.employee_id).single(),
      supabase.from("leave_types").select("name").eq("id", req.leave_type_id).single(),
    ]);
    const empName = empProfile?.full_name ?? "พนักงาน";
    const ltName = ltInfo?.name ?? "ลา";
    const daysLabel = req.working_days ?? req.total_days;
    const cancelMsg = wasPreviouslyApproved
      ? `${empName} ยกเลิกคำขอ${ltName} (${daysLabel} วัน) ที่อนุมัติแล้ว — วันลาถูกคืนกลับ`
      : `${empName} ยกเลิกคำขอ${ltName} (${daysLabel} วัน)`;

    const { data: hrUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["hr", "admin"]);
    if (hrUsers) {
      for (const hr of hrUsers) {
        await createNotificationInternal(supabase, hr.id, "new_leave_request", cancelMsg);
      }
    }
  } catch {
    // Non-blocking: notification failure shouldn't fail cancellation
    console.error("[leave-actions] Failed to send cancel notification");
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

// ═══════════════════════════════════════════════════════════
//  Mutations — Other
// ═══════════════════════════════════════════════════════════

export async function updateLeaveMedicalCert(requestId: string, certPath: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("leave_requests")
    .update({ medical_cert_url: certPath || null })
    .eq("id", requestId)
    .eq("employee_id", user.id);

  if (error) throw new Error("ไม่สามารถบันทึกใบรับรองแพทย์ได้");

  await logAudit(supabase, user.id, "update_medical_cert", "leave_request", requestId);

  revalidatePath(`/dashboard/leaves/${requestId}`);
  revalidatePath("/dashboard/leaves");
}

// ═══════════════════════════════════════════════════════════
//  Admin — Balance management
// ═══════════════════════════════════════════════════════════

/**
 * HR/Admin: create leave_balances rows for all leave_types in the given FY.
 * For VACATION: calculates accumulated days from previous FY (capped by employee_type).
 * Uses upsert — won't overwrite existing rows.
 */
export async function initializeLeaveBalances(
  employeeId: string,
  fiscalYear?: number,
): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  await validateEmployeeExists(supabase, employeeId);

  const fy = fiscalYear ?? currentFiscalYear();

  // Fetch employee type for vacation cap
  const { data: emp } = await supabase
    .from("profiles")
    .select("employee_type")
    .eq("id", employeeId)
    .single();

  // Fetch all leave types
  const { data: leaveTypes } = await supabase
    .from("leave_types")
    .select("id, code, max_days_per_year");

  if (!leaveTypes) return;

  for (const lt of leaveTypes) {
    let accumulatedDays = 0;
    const annualDays = lt.max_days_per_year;

    // VACATION: calculate accumulated from previous FY
    if (lt.code === "VACATION") {
      const cap = getVacationAccumulationCap(emp?.employee_type ?? null);
      if (cap > 0) {
        const prevFy = fy - 1;
        const { data: prevBalance } = await supabase
          .from("leave_balances")
          .select("remaining_days")
          .eq("employee_id", employeeId)
          .eq("leave_type_id", lt.id)
          .eq("fiscal_year", prevFy)
          .maybeSingle();

        accumulatedDays = Math.min(prevBalance?.remaining_days ?? 0, cap);
      }
    }

    // Skip if balance already exists for this FY
    const { data: existing } = await supabase
      .from("leave_balances")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", lt.id)
      .eq("fiscal_year", fy)
      .maybeSingle();

    if (!existing) {
      await supabase.from("leave_balances").insert({
        employee_id: employeeId,
        leave_type_id: lt.id,
        fiscal_year: fy,
        total_days: annualDays + accumulatedDays,
        used_days: 0,
        remaining_days: annualDays + accumulatedDays,
        accumulated_days: accumulatedDays,
      });
    }
  }

  await logAudit(supabase, user.id, "initialize_leave_balances", "leave_balance", employeeId, {
    fiscal_year: fy,
  });
  revalidatePath("/dashboard/hr/master-data");
}

export interface InitBalancesResult {
  employeesProcessed: number;
  rowsCreated: number;
  rowsSkipped: number;
}

/**
 * HR/Admin: initialize leave_balances for ALL active employees in one pass.
 *
 * Idempotent — skips (employee, leave_type) pairs that already have a row for
 * the FY (won't overwrite imported opening balances).
 * For VACATION, carries over previous-FY remaining capped by employee_type.
 *
 * Efficient: a handful of queries + chunked insert (not N per-employee calls).
 */
export async function initializeAllEmployeesBalances(
  fiscalYear?: number,
): Promise<InitBalancesResult> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  const fy = fiscalYear ?? currentFiscalYear();

  // Active employees (exclude rejected) + leave types — fetched once
  const [{ data: employees }, { data: leaveTypes }] = await Promise.all([
    supabase.from("profiles").select("id, employee_type").neq("status", "rejected"),
    supabase.from("leave_types").select("id, code, max_days_per_year"),
  ]);

  if (!employees || employees.length === 0 || !leaveTypes || leaveTypes.length === 0) {
    return { employeesProcessed: 0, rowsCreated: 0, rowsSkipped: 0 };
  }

  // Existing balances for this FY → skip set (don't overwrite)
  const { data: existing } = await supabase
    .from("leave_balances")
    .select("employee_id, leave_type_id")
    .eq("fiscal_year", fy);
  const existsSet = new Set(
    (existing ?? []).map((b) => `${b.employee_id}:${b.leave_type_id}`),
  );

  // Previous-FY vacation remaining (for accumulation)
  const vacationType = leaveTypes.find((lt) => lt.code === "VACATION");
  const prevVacByEmployee = new Map<string, number>();
  if (vacationType) {
    const { data: prev } = await supabase
      .from("leave_balances")
      .select("employee_id, remaining_days")
      .eq("fiscal_year", fy - 1)
      .eq("leave_type_id", vacationType.id);
    for (const p of prev ?? []) {
      prevVacByEmployee.set(p.employee_id, p.remaining_days ?? 0);
    }
  }

  const toInsert: Database["public"]["Tables"]["leave_balances"]["Insert"][] = [];
  let skipped = 0;

  for (const emp of employees) {
    for (const lt of leaveTypes) {
      if (existsSet.has(`${emp.id}:${lt.id}`)) {
        skipped++;
        continue;
      }
      let accumulated = 0;
      if (lt.code === "VACATION") {
        const cap = getVacationAccumulationCap(emp.employee_type ?? null);
        accumulated = cap > 0 ? Math.min(prevVacByEmployee.get(emp.id) ?? 0, cap) : 0;
      }
      const annual = lt.max_days_per_year;
      toInsert.push({
        employee_id: emp.id,
        leave_type_id: lt.id,
        fiscal_year: fy,
        total_days: annual + accumulated,
        used_days: 0,
        remaining_days: annual + accumulated,
        accumulated_days: accumulated,
      });
    }
  }

  let created = 0;
  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("leave_balances").insert(chunk);
    if (error) {
      console.error("[leave-actions] initializeAllEmployeesBalances insert failed:", error);
      throw new Error("ไม่สามารถสร้างยอดวันลาบางส่วนได้");
    }
    created += chunk.length;
  }

  await logAudit(supabase, user.id, "initialize_all_leave_balances", "leave_balance", "batch", {
    fiscal_year: fy,
    created,
    skipped,
  });
  revalidatePath("/dashboard/hr/master-data");

  return { employeesProcessed: employees.length, rowsCreated: created, rowsSkipped: skipped };
}

// ─── CSV opening-balance import (launch-time backfill) ─────

export interface BalanceImportRow {
  email: string;
  sick_remaining?: string;
  personal_remaining?: string;
  vacation_remaining?: string;
  vacation_accumulated?: string;
}

export interface BalanceImportResult {
  success: Array<{ row: number; email: string }>;
  failed: Array<{ row: number; email: string; error: string }>;
  warnings: Array<{ row: number; email: string; warning: string }>;
}

/** Parse a remaining/accumulated cell → number ≥ 0, or null when blank. */
function parseBalanceCell(v: string | undefined): number | null | "invalid" {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return n;
}

/**
 * HR/Admin: import opening leave balances from CSV (wide format, remaining-based).
 *
 * For each employee (matched by email) sets SICK/PERSONAL/VACATION balances for
 * the FY: total = max_days_per_year (+ vacation accumulated, capped by
 * employee_type); used = total − remaining (remaining blank ⇒ full).
 * Upserts (insert new / update existing) — safe to re-run.
 * Maternity is event-based and intentionally not imported.
 */
export async function importLeaveBalances(
  rows: BalanceImportRow[],
  fiscalYear?: number,
): Promise<BalanceImportResult> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("ไม่มีข้อมูลที่จะนำเข้า");
  }
  if (rows.length > 1000) {
    throw new Error("จำนวนแถวเกิน 1000 รายการ");
  }

  const fy = fiscalYear ?? currentFiscalYear();
  const result: BalanceImportResult = { success: [], failed: [], warnings: [] };

  // Reference data — fetched once
  const [{ data: leaveTypes }, { data: profiles }] = await Promise.all([
    supabase.from("leave_types").select("id, code, max_days_per_year"),
    supabase.from("profiles").select("id, email, employee_type").neq("status", "rejected"),
  ]);

  const ltByCode = new Map((leaveTypes ?? []).map((lt) => [lt.code, lt]));
  const profByEmail = new Map(
    (profiles ?? []).map((p) => [p.email.toLowerCase(), p]),
  );

  // Existing balances for FY → key `${empId}:${ltId}` → balance id
  const { data: existing } = await supabase
    .from("leave_balances")
    .select("id, employee_id, leave_type_id")
    .eq("fiscal_year", fy);
  const existingId = new Map(
    (existing ?? []).map((b) => [`${b.employee_id}:${b.leave_type_id}`, b.id]),
  );

  type BalRow = Database["public"]["Tables"]["leave_balances"]["Insert"];
  const inserts: BalRow[] = [];
  const updates: Array<{ id: string; data: Partial<BalRow> }> = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const email = (rows[i].email ?? "").trim().toLowerCase();
    if (!email) {
      result.failed.push({ row: rowNum, email: "", error: "ไม่มีอีเมล" });
      continue;
    }
    const prof = profByEmail.get(email);
    if (!prof) {
      result.failed.push({ row: rowNum, email, error: "ไม่พบพนักงานอีเมลนี้ในระบบ" });
      continue;
    }

    // Parse cells
    const sickRem = parseBalanceCell(rows[i].sick_remaining);
    const persRem = parseBalanceCell(rows[i].personal_remaining);
    const vacRem = parseBalanceCell(rows[i].vacation_remaining);
    const vacAcc = parseBalanceCell(rows[i].vacation_accumulated);
    if ([sickRem, persRem, vacRem, vacAcc].includes("invalid")) {
      result.failed.push({ row: rowNum, email, error: "ตัวเลขไม่ถูกต้อง (ต้องเป็นจำนวน ≥ 0)" });
      continue;
    }

    // Build per-type balance rows
    const plan: Array<{ code: string; remaining: number | null; accumulatedInput: number | null }> = [
      { code: "SICK", remaining: sickRem as number | null, accumulatedInput: null },
      { code: "PERSONAL", remaining: persRem as number | null, accumulatedInput: null },
      { code: "VACATION", remaining: vacRem as number | null, accumulatedInput: vacAcc as number | null },
    ];

    let rowError: string | null = null;
    const rowBalances: BalRow[] = [];

    for (const p of plan) {
      const lt = ltByCode.get(p.code);
      if (!lt) continue; // leave type not configured — skip silently

      let accumulated = 0;
      if (p.code === "VACATION") {
        const cap = getVacationAccumulationCap(prof.employee_type ?? null);
        const requested = p.accumulatedInput ?? 0;
        accumulated = cap > 0 ? Math.min(requested, cap) : 0;
        if (requested > accumulated) {
          result.warnings.push({
            row: rowNum,
            email,
            warning: `วันสะสมพักผ่อน ${requested} เกินเพดาน ${cap} — ปรับเป็น ${accumulated}`,
          });
        }
      }

      const total = lt.max_days_per_year + accumulated;
      const remaining = p.remaining ?? total; // blank ⇒ full entitlement
      if (remaining > total) {
        rowError = `วันคงเหลือ ${p.code} (${remaining}) เกินสิทธิ์รวม (${total})`;
        break;
      }
      const used = Math.max(0, total - remaining);

      rowBalances.push({
        employee_id: prof.id,
        leave_type_id: lt.id,
        fiscal_year: fy,
        total_days: total,
        used_days: used,
        remaining_days: remaining,
        accumulated_days: accumulated,
      });
    }

    if (rowError) {
      result.failed.push({ row: rowNum, email, error: rowError });
      continue;
    }

    for (const bal of rowBalances) {
      const key = `${bal.employee_id}:${bal.leave_type_id}`;
      const exId = existingId.get(key);
      if (exId) {
        updates.push({
          id: exId,
          data: {
            total_days: bal.total_days,
            used_days: bal.used_days,
            remaining_days: bal.remaining_days,
            accumulated_days: bal.accumulated_days,
            updated_at: new Date().toISOString(),
          },
        });
      } else {
        inserts.push(bal);
      }
    }
    result.success.push({ row: rowNum, email });
  }

  // Execute — batch insert new, then update existing
  const CHUNK = 500;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error } = await supabase.from("leave_balances").insert(chunk);
    if (error) {
      console.error("[leave-actions] importLeaveBalances insert failed:", error);
      throw new Error("บันทึกยอดวันลาบางส่วนไม่สำเร็จ");
    }
  }
  for (const u of updates) {
    const { error } = await supabase.from("leave_balances").update(u.data).eq("id", u.id);
    if (error) {
      console.error("[leave-actions] importLeaveBalances update failed:", error);
      throw new Error("ปรับปรุงยอดวันลาบางส่วนไม่สำเร็จ");
    }
  }

  await logAudit(supabase, user.id, "import_leave_balances", "leave_balance", "batch", {
    fiscal_year: fy,
    success: result.success.length,
    failed: result.failed.length,
    inserted: inserts.length,
    updated: updates.length,
  });
  revalidatePath("/dashboard/hr/leave-balances");
  revalidatePath("/dashboard/leaves");

  return result;
}
