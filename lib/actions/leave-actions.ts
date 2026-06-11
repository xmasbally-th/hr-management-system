"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { createNotificationInternal } from "./notification-actions";
import { UUID_RE, validateRequestDates, validateEmployeeExists, validateTextField } from "./validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { currentFiscalYear, fiscalYearRange, performanceCycleRange } from "@/lib/date-ranges";
import { calculateWorkingDays, calculateCalendarDays } from "@/lib/working-days";
import {
  COMMITTED_LEAVE_STATUSES,
  enforceLeaveTypeRules,
  getVacationAccumulationCap,
} from "@/lib/leave-rules";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ─── Service-role admin client ─────────────────────────────
// Leave balances + document_tracking are SYSTEM-managed (RLS restricts
// writes to hr/admin). When an employee submits/cancels their own request
// we still need to reserve/release balance and create tracking rows, so
// those mutations go through the service-role client. Only ever called
// from authenticated server actions after auth/role checks.
function getAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ─── Balance reserve / release (W0 reserve-on-submit) ──────

/** Reserve `days` against an employee's leave balance for the FY (used += days).
 *  Auto-creates the balance row from leave_type entitlement if missing. */
async function reserveLeaveBalance(
  admin: SupabaseClient<Database>,
  employeeId: string,
  leaveTypeId: string,
  days: number,
  fy: number,
): Promise<void> {
  const { data: bal } = await admin
    .from("leave_balances")
    .select("id, total_days, used_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("fiscal_year", fy)
    .maybeSingle();

  if (bal) {
    const newUsed = (bal.used_days ?? 0) + days;
    await admin
      .from("leave_balances")
      .update({
        used_days: newUsed,
        remaining_days: Math.max(0, bal.total_days - newUsed),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bal.id);
  } else {
    const { data: lt } = await admin
      .from("leave_types")
      .select("max_days_per_year")
      .eq("id", leaveTypeId)
      .single();
    const total = lt?.max_days_per_year ?? 0;
    await admin.from("leave_balances").insert({
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      fiscal_year: fy,
      total_days: total,
      used_days: days,
      remaining_days: Math.max(0, total - days),
      accumulated_days: 0,
    });
  }
}

/** Release `days` back to an employee's balance (used -= days, floored at 0). */
async function releaseLeaveBalance(
  admin: SupabaseClient<Database>,
  employeeId: string,
  leaveTypeId: string,
  days: number,
  fy: number,
): Promise<void> {
  const { data: bal } = await admin
    .from("leave_balances")
    .select("id, total_days, used_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("fiscal_year", fy)
    .maybeSingle();
  if (!bal) return;
  const newUsed = Math.max(0, (bal.used_days ?? 0) - days);
  await admin
    .from("leave_balances")
    .update({
      used_days: newUsed,
      remaining_days: Math.max(0, bal.total_days - newUsed),
      updated_at: new Date().toISOString(),
    })
    .eq("id", bal.id);
}

/**
 * B2: snapshot `accumulated_days` and `annual_days` from leave_balances for
 * the current fiscal year — single source of truth. Used when inserting
 * `leave_vacation_details` so users can no longer self-report these.
 *
 * Returns 0/0 if no balance row exists (e.g. employee hasn't been initialized).
 * `annual_days` is derived as `total_days - accumulated_days` so the two
 * always sum back to the entitlement shown on the form.
 */
async function readVacationBalanceSnapshot(
  supabase: SupabaseClient<Database>,
  employeeId: string,
  leaveTypeId: string,
): Promise<{ accumulated: number; annual: number }> {
  const { data: bal } = await supabase
    .from("leave_balances")
    .select("accumulated_days, total_days")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leaveTypeId)
    .eq("fiscal_year", currentFiscalYear())
    .maybeSingle();
  const accumulated = bal?.accumulated_days ?? 0;
  const annual = Math.max(0, (bal?.total_days ?? 0) - accumulated);
  return { accumulated, annual };
}

/**
 * C1: refuse a new leave request when its date range overlaps with another
 * committed (non-rejected/cancelled) request from the same employee.
 *
 * Two ranges [a1,a2] and [b1,b2] overlap iff a1 <= b2 AND a2 >= b1.
 * `excludeRequestId` lets the caller skip a specific row (currently unused —
 * kept for future edit flows).
 */
async function checkLeaveOverlap(
  supabase: SupabaseClient<Database>,
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeRequestId?: string,
): Promise<void> {
  let query = supabase
    .from("leave_requests")
    .select("id, start_date, end_date, status")
    .eq("employee_id", employeeId)
    .in("status", COMMITTED_LEAVE_STATUSES)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);
  if (excludeRequestId) query = query.neq("id", excludeRequestId);
  const { data, error } = await query;

  if (error) {
    console.warn("[leave-actions] overlap check failed:", error.message);
    return; // fail open — don't block submission on infra glitch
  }
  if (data && data.length > 0) {
    const c = data[0];
    throw new Error(
      `ช่วงวันที่ลาทับกับคำขออื่นที่ยังไม่ปิด (${c.start_date} ถึง ${c.end_date}) กรุณายกเลิกใบเดิมหรือเลือกวันใหม่`,
    );
  }
}

/** Create the document_tracking row that drives the signature workflow. */
async function createLeaveDocumentTracking(
  admin: SupabaseClient<Database>,
  requestId: string,
): Promise<void> {
  const { error } = await admin
    .from("document_tracking")
    .insert({ reference_id: requestId, document_type: "leave" });
  if (error) {
    console.error("[leave-actions] create document_tracking failed:", error.message);
  }
}

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
  /** Fiscal year (Gregorian) to scope leave history by. Default: current FY. */
  fy?: number;
  /** Half-year round (1 = Oct–Mar, 2 = Apr–Sep). Omit = whole fiscal year. */
  round?: 1 | 2;
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

  // Scope by fiscal year + optional half-year round (filters start_date).
  const fy = params?.fy ?? currentFiscalYear();
  const range = params?.round
    ? performanceCycleRange(fy, params.round)
    : fiscalYearRange(fy);

  let query = supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name)
    `, { count: "exact" })
    .eq("employee_id", user.id)
    .gte("start_date", range.start)
    .lte("start_date", range.end);

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

export async function getMyLeaveBalances(fiscalYear?: number) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const fy = fiscalYear ?? currentFiscalYear();

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      leave_type:leave_types(name, code)
    `)
    .eq("employee_id", user.id)
    .eq("fiscal_year", fy);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลวันลาคงเหลือได้");
  return data;
}

/**
 * Count the current user's leave requests per leave_type for a fiscal year.
 * Powers the "X ครั้ง" figure on the leave summary cards. Counts every
 * request (any status) whose start_date falls in the FY range.
 */
export async function getMyLeaveCountsByType(
  fiscalYear?: number,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const fy = fiscalYear ?? currentFiscalYear();
  const range = fiscalYearRange(fy);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("leave_type_id")
    .eq("employee_id", user.id)
    .gte("start_date", range.start)
    .lte("start_date", range.end);

  if (error) throw new Error("ไม่สามารถดึงจำนวนครั้งการลาได้");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.leave_type_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/**
 * HR/Admin: fetch any employee's leave_balances for a fiscal year.
 *
 * Powers the paper-channel form's per-type balance feedback — HR picks an
 * employee and sees their current entitlement / used / remaining so they
 * don't submit a paper slip that the server will reject for exceeding cap.
 * Same row shape as `getMyLeaveBalances` so the caller can reuse the
 * Balance interface.
 */
export async function getEmployeeLeaveBalances(
  employeeId: string,
  fiscalYear?: number,
) {
  if (!UUID_RE.test(employeeId)) throw new Error("รหัสพนักงานไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  const fy = fiscalYear ?? currentFiscalYear();

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      *,
      leave_type:leave_types(name, code)
    `)
    .eq("employee_id", employeeId)
    .eq("fiscal_year", fy);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลวันลาคงเหลือได้");
  return data ?? [];
}

/**
 * D1: list every leave_balances row for a fiscal year, joined with employee
 * and leave_type. Used by the HR balance manager.
 */
export async function getAllLeaveBalancesForFY(fy: number) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  const { data, error } = await supabase
    .from("leave_balances")
    .select(`
      id, total_days, used_days, accumulated_days, fiscal_year,
      employee:profiles!leave_balances_employee_id_fkey(
        id, full_name, email, employee_type
      ),
      leave_type:leave_types(id, name, code)
    `)
    .eq("fiscal_year", fy)
    .order("employee_id");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลยอดวันลาได้");
  return data;
}

/**
 * D1: manual edit of a leave_balances row by HR/admin. Records before/after
 * in audit_log. `used_days` must not exceed `total_days + accumulated_days`
 * but we allow any non-negative number to support correction of bad imports.
 */
export async function updateLeaveBalance(
  balanceId: string,
  updates: {
    total_days?: number;
    used_days?: number;
    accumulated_days?: number;
  },
) {
  if (!UUID_RE.test(balanceId)) throw new Error("รหัสยอดวันลาไม่ถูกต้อง");

  const sanitized: typeof updates = {};
  for (const key of ["total_days", "used_days", "accumulated_days"] as const) {
    const v = updates[key];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < 0 || v > 9999) {
      throw new Error(`ค่า ${key} ต้องเป็นตัวเลข 0-9999`);
    }
    sanitized[key] = v;
  }
  if (Object.keys(sanitized).length === 0) {
    throw new Error("ไม่มีข้อมูลที่ต้องอัปเดต");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }

  // Read existing row for audit before/after + remaining_days recompute
  const { data: before } = await supabase
    .from("leave_balances")
    .select("id, employee_id, leave_type_id, fiscal_year, total_days, used_days, accumulated_days")
    .eq("id", balanceId)
    .single();
  if (!before) throw new Error("ไม่พบยอดวันลานี้");

  const next = { ...before, ...sanitized };
  const remaining = Math.max(0, next.total_days - next.used_days);

  const { error } = await supabase
    .from("leave_balances")
    .update({
      ...sanitized,
      remaining_days: remaining,
      updated_at: new Date().toISOString(),
    })
    .eq("id", balanceId);
  if (error) throw new Error("บันทึกยอดวันลาไม่สำเร็จ");

  await logAudit(supabase, user.id, "edit_leave_balance", "leave_balance", balanceId, {
    employee_id: before.employee_id,
    fiscal_year: before.fiscal_year,
    before: {
      total_days: before.total_days,
      used_days: before.used_days,
      accumulated_days: before.accumulated_days,
    },
    after: {
      total_days: next.total_days,
      used_days: next.used_days,
      accumulated_days: next.accumulated_days,
    },
  });

  revalidatePath("/dashboard/hr/leave-balances");
  return { success: true };
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

/**
 * All leave requests whose start_date falls within a fiscal year (Oct 1 – Sep 30).
 * Not paginated — the HR leaves dashboard loads a whole FY at once and filters
 * by round + tab client-side. ~hundreds of rows for ~100 staff.
 */
export async function getLeaveRequestsForFiscalYear(
  fy: number,
): Promise<Record<string, unknown>[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const range = fiscalYearRange(fy);
  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name, code),
      employee:profiles!leave_requests_employee_id_fkey(full_name, email, position_title)
    `)
    .gte("start_date", range.start)
    .lte("start_date", range.end)
    .order("start_date", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาตามปีงบประมาณได้");
  return data ?? [];
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
      employee:profiles!leave_requests_employee_id_fkey(id, full_name, email, position_title, department_id, employee_type),
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
    .select("id, full_name, email, gender, employee_type, position_title")
    .eq("status", "approved")
    .order("full_name");

  if (error) {
    // Keep the structured server log; throw a user-facing Thai message.
    console.error(
      "[getEmployeesForSelection] supabase error:",
      JSON.stringify({ message: error.message, code: error.code, details: error.details, hint: error.hint }),
    );
    throw new Error("ไม่สามารถดึงรายชื่อพนักงานได้");
  }
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
  /** Personal-leave plan type — when "planned" the server enforces the
   *  advance-notice window from leave_policy. Omitted = paper/HR channel
   *  (HR can backdate). */
  personal_plan?: "planned" | "urgent";
  // Vacation-specific fields. accumulated_days/annual_days are derived from
  // leave_balances on the server (B2 single source of truth) — input only
  // carries substitutes + branch-head opinion.
  vacation_details?: {
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

  // ── C1: refuse if this overlaps with another in-flight request ──
  await checkLeaveOverlap(supabase, user.id, input.start_date, input.end_date);

  // ── Enforce business rules + calculate working days ──
  const { workingDays, leaveTypeName, employeeName } = await enforceLeaveTypeRules(
    supabase, input.leave_type_id, user.id,
    input.start_date, input.end_date, input.total_days,
    input.medical_cert_url, input.expected_delivery_date,
    input.personal_plan,
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
    // B2: snapshot accumulated/annual days from leave_balances (single source).
    const { accumulated, annual } = await readVacationBalanceSnapshot(
      supabase, user.id, input.leave_type_id,
    );
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: accumulated,
        annual_days: annual,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: sanitizedOpinion,
      });

    if (vacError) {
      console.error("[leave-actions] Failed to insert vacation details:", vacError);
    }
  }

  // ── Reserve balance on submit (W0) + create document_tracking (CW7) ──
  const admin = getAdminClient();
  await reserveLeaveBalance(admin, user.id, input.leave_type_id, workingDays, currentFiscalYear());
  await createLeaveDocumentTracking(admin, request.id);

  // ── Notify HR/Manager (reuse data from enforceLeaveTypeRules) ──
  const notifMsg = `มีคำขอ${leaveTypeName}ใหม่จาก ${employeeName} (${workingDays} วัน) รอการอนุมัติ`;

  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"]);
  if (hrUsers) {
    await Promise.all(
      hrUsers.map((hr) => createNotificationInternal(supabase, hr.id, "new_leave_request", notifMsg)),
    );
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

  // ── C1: refuse if this overlaps with another in-flight request ──
  await checkLeaveOverlap(supabase, employeeId, input.start_date, input.end_date);

  // ── Enforce business rules (no toggle check — paper channel) ──
  // personal_plan intentionally omitted: HR can backdate paper requests.
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
    // B2: snapshot accumulated/annual days from leave_balances (single source).
    const { accumulated, annual } = await readVacationBalanceSnapshot(
      supabase, employeeId, input.leave_type_id,
    );
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: accumulated,
        annual_days: annual,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: sanitizedOpinion,
      });

    if (vacError) {
      console.error("[leave-actions] HR vacation details insert failed:", vacError);
    }
  }

  // ── Reserve balance on submit (W0) + create document_tracking (CW7) ──
  const admin = getAdminClient();
  await reserveLeaveBalance(admin, employeeId, input.leave_type_id, workingDays, currentFiscalYear());
  await createLeaveDocumentTracking(admin, request.id);

  // ── Notify HR/Admin (exclude the HR who submitted) ──
  const notifMsg = `มีคำขอ${leaveTypeName}ใหม่จาก ${employeeName} (${workingDays} วัน · กระดาษ) รอการอนุมัติ`;
  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"])
    .neq("id", user.id);
  if (hrUsers) {
    await Promise.all(
      hrUsers.map((hr) => createNotificationInternal(supabase, hr.id, "new_leave_request", notifMsg)),
    );
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

  // Balance was already reserved at submission (W0 reserve-on-submit) —
  // approval only advances status, it must NOT add days again.
  const daysToAdd = updated.working_days ?? updated.total_days;

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
    .select("employee_id, leave_type_id, working_days, total_days")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถปฏิเสธคำขอลาได้ (อาจถูกดำเนินการแล้ว)");

  // Release the balance reserved at submission (W0)
  await releaseLeaveBalance(
    getAdminClient(),
    updated.employee_id,
    updated.leave_type_id,
    updated.working_days ?? updated.total_days,
    currentFiscalYear(),
  );

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

/**
 * ยกเลิกใบลาระดับคณะ (ก่อนส่งมหาวิทยาลัย) — HR/Admin เท่านั้น
 * พนักงานที่ต้องการยกเลิกต้องแจ้ง HR ให้ดำเนินการแทน · บังคับระบุเหตุผล
 * และบันทึกประวัติการยกเลิกลง leave_cancellation_requests ไว้ดูย้อนหลัง
 * (record สถานะ completed — ไม่ต้องเดินเอกสาร เพราะยังไม่พ้นระดับคณะ)
 */
export async function cancelLeaveRequest(requestId: string, reason: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผลการยกเลิก", 1000);
  if (!sanitizedReason) throw new Error("กรุณาระบุเหตุผลการยกเลิก");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const profile = await getProfile(supabase, user.id);
  const isHrAdmin = profile?.role === "hr" || profile?.role === "admin";
  if (!isHrAdmin) {
    throw new Error("Forbidden: การยกเลิกใบลาระดับคณะดำเนินการโดย HR/Admin — กรุณาติดต่อฝ่ายบุคคล");
  }

  // Read current status so we know whether to restore balance
  const { data: req } = await supabase
    .from("leave_requests")
    .select("id, status, employee_id, leave_type_id, working_days, total_days")
    .eq("id", requestId)
    .single();

  if (!req) throw new Error("ไม่พบคำขอลานี้");
  // Direct cancellation is allowed only BEFORE the leave has been sent to
  // the university. Once sent (awaiting_university) or completed, the
  // formal "ใบขอยกเลิกวันลา" flow (cancellation request routed through
  // ผอ./คณบดี/อธิการบดี) is required.
  const CANCELLABLE = ["pending", "awaiting_chair", "awaiting_director", "awaiting_dean", "approved"];
  if (!CANCELLABLE.includes(req.status)) {
    throw new Error(
      "ใบลานี้ถูกส่งให้มหาวิทยาลัยแล้ว — ต้องยื่น \"ใบขอยกเลิกวันลา\" ผ่านการเดินเอกสารแทน",
    );
  }
  const cancelledForOther = req.employee_id !== user.id;

  // Atomic: only cancel if status hasn't changed since our read
  const { data: cancelled, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", req.status) // ← guard against race condition
    .select("id")
    .single();

  if (error || !cancelled) {
    throw new Error("ไม่สามารถยกเลิกคำขอลาได้ (สถานะอาจเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า)");
  }

  // ── Release the reserved balance (W0 — all committed statuses reserve) ──
  await releaseLeaveBalance(
    getAdminClient(),
    req.employee_id,
    req.leave_type_id,
    req.working_days ?? req.total_days,
    currentFiscalYear(),
  );

  // ── ประวัติการยกเลิก — record ปิดแล้ว (ไม่ต้องเดินเอกสารระดับคณะ) ──
  const { error: histErr } = await getAdminClient()
    .from("leave_cancellation_requests")
    .insert({
      leave_request_id: requestId,
      requested_by: user.id,
      reason: sanitizedReason,
      status: "completed",
      approver_id: user.id,
    });
  if (histErr) console.error("[leave-actions] cancel history insert failed:", histErr.message);

  await logAudit(supabase, user.id, "cancel_leave", "leave_request", requestId, {
    prev_status: req.status,
    reason: sanitizedReason,
    employee_id: req.employee_id,
  });

  // ── Notify HR/Admin (always) + the owner when cancelled on their behalf ──
  try {
    const [{ data: empProfile }, { data: ltInfo }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", req.employee_id).single(),
      supabase.from("leave_types").select("name").eq("id", req.leave_type_id).single(),
    ]);
    const empName = empProfile?.full_name ?? "พนักงาน";
    const ltName = ltInfo?.name ?? "ลา";
    const daysLabel = req.working_days ?? req.total_days;
    const cancelMsg = `HR ยกเลิกคำขอ${ltName} (${daysLabel} วัน) ของ ${empName} — วันลาถูกคืนกลับ · เหตุผล: ${sanitizedReason}`;

    const { data: hrUsers } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["hr", "admin"]);

    const notifyTargets: string[] = (hrUsers ?? []).map((hr) => hr.id);
    if (cancelledForOther) notifyTargets.push(req.employee_id);

    await Promise.all(
      notifyTargets.map((uid) =>
        createNotificationInternal(supabase, uid, "new_leave_request", cancelMsg),
      ),
    );
  } catch {
    // Non-blocking: notification failure shouldn't fail cancellation
    console.error("[leave-actions] Failed to send cancel notification");
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath(`/dashboard/leaves/${requestId}`);
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

// ═══════════════════════════════════════════════════════════
//  Signature workflow (ผอ. → คณบดี → สแกน → ส่งมหาวิทยาลัย)
//  HR/Admin only (managers are read-only — CW5). Balance is NOT
//  touched here (reserved at submit, W0); these only advance status,
//  stamp document_tracking dates, audit, and notify the employee.
// ═══════════════════════════════════════════════════════════

async function requireHrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }
  return user.id;
}

type ReqStatus = Database["public"]["Tables"]["leave_requests"]["Row"]["status"];

interface StageConfig {
  from: ReqStatus[];
  to?: ReqStatus;
  trackingDates?: string[];
  trackingExtra?: Record<string, unknown>;
  audit: string;
  notifyType?: string;
  notifyMsg?: (ltName: string) => string;
  /**
   * If set, this is a *signature* step that the designated approver for the
   * role may perform (in addition to HR/Admin). Unset = routing/admin step,
   * HR/Admin only. For "dean", an active acting-delegate (รักษาราชการแทน) is
   * also allowed.
   */
  signerRole?: "chair" | "director" | "dean";
  /**
   * If set, after advancing the stage, notify the designated approver(s) for
   * this role that a request now awaits their signature (incl. dean acting
   * delegates). Used by the routing steps.
   */
  notifyApproverRole?: "chair" | "director" | "dean";
}

/**
 * Resolve which user ids may sign a given stage for a given request, plus
 * whether the acting user is doing so via รักษาราชการแทน (dean only).
 */
async function resolveStageSigners(
  supabase: Awaited<ReturnType<typeof createClient>>,
  role: "chair" | "director" | "dean",
  employeeId: string,
  userId: string,
): Promise<{ allowed: string[]; viaActing: boolean }> {
  if (role === "chair") {
    const { data: emp } = await supabase
      .from("profiles").select("department_id").eq("id", employeeId).single();
    if (!emp?.department_id) return { allowed: [], viaActing: false };
    const { data } = await supabase
      .from("workflow_approvers")
      .select("user_id")
      .eq("approver_role", "chair")
      .eq("department_id", emp.department_id)
      .maybeSingle();
    return { allowed: data?.user_id ? [data.user_id] : [], viaActing: false };
  }
  if (role === "director") {
    const { data } = await supabase
      .from("workflow_approvers")
      .select("user_id")
      .eq("approver_role", "director")
      .is("department_id", null)
      .maybeSingle();
    return { allowed: data?.user_id ? [data.user_id] : [], viaActing: false };
  }
  // dean — include any active acting-delegate (รักษาราชการแทน)
  const today = new Date().toISOString().slice(0, 10);
  const ids = new Set<string>();
  const { data: deanRow } = await supabase
    .from("workflow_approvers")
    .select("user_id")
    .eq("approver_role", "dean")
    .is("department_id", null)
    .maybeSingle();
  const deanId = deanRow?.user_id ?? null;
  if (deanId) ids.add(deanId);
  const { data: acts } = await supabase
    .from("acting_delegations")
    .select("delegate_user_id")
    .eq("approver_role", "dean")
    .lte("start_date", today)
    .gte("end_date", today);
  for (const a of acts ?? []) ids.add(a.delegate_user_id);
  const viaActing = userId !== deanId && (acts ?? []).some((a) => a.delegate_user_id === userId);
  return { allowed: [...ids], viaActing };
}

/** Shared HR/Admin workflow step: guard status, advance, stamp tracking,
 *  audit, notify employee, revalidate all leave/document surfaces. */
async function runLeaveStage(requestId: string, cfg: StageConfig): Promise<void> {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  const isHrAdmin = !!profile && (profile.role === "hr" || profile.role === "admin");

  // Fetch first so we can authorize signature steps against the designated
  // approver before mutating. The guarded UPDATE below still protects races.
  const { data: cur, error: curErr } = await supabase
    .from("leave_requests")
    .select("employee_id, leave_type_id, status")
    .eq("id", requestId)
    .single();
  if (curErr || !cur) throw new Error("ไม่พบคำขอลา");
  if (!cfg.from.includes(cur.status)) {
    throw new Error("ไม่สามารถดำเนินการได้ (สถานะไม่ถูกต้อง กรุณารีเฟรช)");
  }

  // Authorize: HR/Admin may do any step. A designated approver may do their
  // own signature step (cfg.signerRole). Routing/admin steps are HR/Admin only.
  if (!isHrAdmin) {
    if (!cfg.signerRole) throw new Error("Forbidden: HR/Admin only");
    const { allowed } = await resolveStageSigners(
      supabase, cfg.signerRole, cur.employee_id, user.id,
    );
    if (!allowed.includes(user.id)) {
      throw new Error("Forbidden: คุณไม่มีสิทธิ์ลงนามขั้นตอนนี้");
    }
  }
  const actorId = user.id;

  // Mutations run with the admin client: a designated approver (e.g. a
  // manager who is the director) passes the app-level authorization above
  // but has no RLS write access to leave_requests / document_tracking.
  const db = getAdminClient();

  let row: { employee_id: string; leave_type_id: string } = {
    employee_id: cur.employee_id,
    leave_type_id: cur.leave_type_id,
  };
  if (cfg.to) {
    const { data, error } = await db
      .from("leave_requests")
      // Record who performed the approving step — the detail page's
      // "ผู้อนุมัติ" field was blank when approval came via this workflow.
      .update(cfg.to === "approved" ? { status: cfg.to, approver_id: actorId } : { status: cfg.to })
      .eq("id", requestId)
      .in("status", cfg.from)
      .select("employee_id, leave_type_id")
      .single();
    if (error || !data) throw new Error("ไม่สามารถดำเนินการได้ (สถานะอาจเปลี่ยนไปแล้ว กรุณารีเฟรช)");
    row = data;
  }

  if (cfg.trackingDates?.length || cfg.trackingExtra) {
    const now = new Date().toISOString();
    const tpatch: Record<string, unknown> = { ...(cfg.trackingExtra ?? {}) };
    for (const c of cfg.trackingDates ?? []) tpatch[c] = now;
    const { error: terr } = await db
      .from("document_tracking")
      .update(tpatch as Database["public"]["Tables"]["document_tracking"]["Update"])
      .eq("reference_id", requestId);
    if (terr) console.error("[leave-actions] tracking update failed:", terr.message);
  }

  await logAudit(db, actorId, cfg.audit, "leave_request", requestId);

  if (cfg.notifyType && cfg.notifyMsg) {
    const { data: lt } = await db
      .from("leave_types").select("name").eq("id", row.leave_type_id).single();
    await createNotificationInternal(
      db, row.employee_id, cfg.notifyType, cfg.notifyMsg(lt?.name ?? "ลา"),
    );
  }

  // Notify the approver(s) who now need to sign (chair/director/dean + acting).
  if (cfg.notifyApproverRole) {
    try {
      const { allowed } = await resolveStageSigners(db, cfg.notifyApproverRole, row.employee_id, actorId);
      const { data: lt2 } = await db
        .from("leave_types").select("name").eq("id", row.leave_type_id).single();
      const ltName = lt2?.name ?? "ลา";
      await Promise.all(
        allowed.map((uid) =>
          createNotificationInternal(db, uid, "leave_status_update", `มีคำขอ${ltName}รอการลงนามของคุณ`),
        ),
      );
    } catch (e) {
      console.error("[leave-actions] approver notify failed:", e);
    }
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath(`/dashboard/leaves/${requestId}`);
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/hr/documents");
  revalidatePath("/dashboard/approvals/leaves");
  revalidatePath("/dashboard/approvals/documents");
}

/** Step 0a (vacation + academic staff only): HR ส่งให้ประธานสาขาวิชาให้ความเห็น */
export async function routeToChair(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["pending"],
    to: "awaiting_chair",
    trackingDates: ["sent_to_chair_date"],
    audit: "route_to_chair",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `คำขอ${lt}ของคุณถูกส่งให้ประธานสาขาวิชาให้ความเห็น`,
    notifyApproverRole: "chair",
  });
}

/** Step 0b: ประธานสาขาวิชาให้ความเห็น + ลงนาม (signable by the chair or HR/Admin) */
export async function markChairSigned(requestId: string, opinion?: string) {
  const cleaned =
    opinion && opinion.trim()
      ? validateTextField(opinion, "ความเห็นประธานสาขา", 500)
      : null;

  await runLeaveStage(requestId, {
    from: ["awaiting_chair"],
    trackingDates: ["chair_signed_date"],
    signerRole: "chair",
    audit: "chair_signed",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ประธานสาขาวิชาให้ความเห็น/ลงนามคำขอ${lt}แล้ว`,
  });

  // Persist the chair's opinion onto the vacation detail (admin client — the
  // chair is already authorized by runLeaveStage above).
  if (cleaned !== null) {
    const admin = getAdminClient();
    const { error } = await admin
      .from("leave_vacation_details")
      .update({ branch_head_opinion: cleaned })
      .eq("request_id", requestId);
    if (error) console.error("[leave-actions] chair opinion save failed:", error.message);
  }
}

/** Step 1: HR ส่งใบลาให้ผู้อำนวยการลงนาม (จาก pending หรือหลังประธานสาขาลงนาม) */
export async function routeToDirector(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["pending", "awaiting_chair"],
    to: "awaiting_director",
    trackingDates: ["sent_to_director_date"],
    audit: "route_to_director",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `คำขอ${lt}ของคุณถูกส่งให้ผู้อำนวยการลงนามแล้ว`,
    notifyApproverRole: "director",
  });
}

/** Step 2: ผู้อำนวยการลงนาม (signable by the director or HR/Admin) */
export async function markDirectorSigned(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["awaiting_director"],
    trackingDates: ["director_signed_date"],
    signerRole: "director",
    audit: "director_signed",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ผู้อำนวยการลงนามคำขอ${lt}ของคุณแล้ว`,
  });
}

/** Step 3: HR ส่งใบลาให้คณบดีลงนาม */
export async function routeToDean(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["awaiting_director"],
    to: "awaiting_dean",
    trackingDates: ["sent_to_dean_date"],
    audit: "route_to_dean",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `คำขอ${lt}ของคุณถูกส่งให้คณบดีลงนามแล้ว`,
    notifyApproverRole: "dean",
  });
}

/** Step 4: คณบดีลงนาม → อนุมัติ (signable by the dean, an active acting-delegate,
 *  or HR/Admin; balance ถูกจองตั้งแต่ยื่นแล้ว ไม่แตะซ้ำ) */
export async function markDeanSigned(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["awaiting_dean"],
    to: "approved",
    trackingDates: ["dean_signed_date"],
    signerRole: "dean",
    audit: "dean_signed",
    notifyType: "leave_approved",
    notifyMsg: (lt) => `คำขอ${lt}ของคุณได้รับการอนุมัติแล้ว (คณบดีลงนามครบ)`,
  });
}

/** Step 5: HR สแกน + อัปโหลดเอกสารที่ลงนามครบระดับคณะ (faculty) — ก่อนส่ง/เก็บแฟ้ม */
export async function markLeaveScanned(requestId: string, facultyDocUrl: string) {
  const url = validateTextField(facultyDocUrl, "ไฟล์เอกสาร", 500);
  return runLeaveStage(requestId, {
    from: ["approved"],
    trackingDates: ["scanned_upload_date"],
    trackingExtra: { scanned_document_url: url },
    audit: "leave_scanned",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ใบลา${lt}ของคุณถูกสแกนเก็บเข้าแฟ้มแล้ว`,
  });
}

/** Step 6a (optional): HR ส่งใบลาให้มหาวิทยาลัย/อธิการบดีลงนาม → รอเอกสารกลับ */
export async function sendLeaveToUniversity(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["approved"],
    to: "awaiting_university",
    trackingDates: ["sent_to_president_date"],
    audit: "send_leave_to_university",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ใบลา${lt}ของคุณถูกส่งให้มหาวิทยาลัย/อธิการบดีลงนามแล้ว`,
  });
}

/** Step 6b: HR รับเอกสารคืนจากมหาวิทยาลัย (อธิการบดีลงนาม) + อัปโหลดเก็บแฟ้ม → จบ */
export async function receiveLeaveFromUniversity(requestId: string, signedDocUrl: string) {
  const url = validateTextField(signedDocUrl, "ไฟล์เอกสารที่ลงนาม", 500);
  return runLeaveStage(requestId, {
    from: ["awaiting_university"],
    to: "completed",
    trackingDates: ["president_signed_date"],
    trackingExtra: { president_document_url: url },
    audit: "receive_leave_from_university",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ใบลา${lt}ของคุณรับเอกสารคืนจากมหาวิทยาลัย (ลงนามครบ) — เสร็จสิ้นกระบวนการ`,
  });
}

/** Step 6 (faculty-only path): จบกระบวนการที่ระดับคณะ โดยไม่ส่งมหาวิทยาลัย */
export async function completeLeaveAtFaculty(requestId: string) {
  return runLeaveStage(requestId, {
    from: ["approved"],
    to: "completed",
    audit: "complete_leave_faculty",
    notifyType: "leave_status_update",
    notifyMsg: (lt) => `ใบลา${lt}ของคุณเสร็จสิ้นกระบวนการแล้ว`,
  });
}

/** Reject at any stage (HR validation / ผอ. / คณบดี). Releases reserved balance. */
export async function rejectLeaveAtStage(
  requestId: string,
  level: "hr" | "chair" | "director" | "dean" | "president",
  reason: string,
) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผล", 500);
  if (!["hr", "chair", "director", "dean", "president"].includes(level)) {
    throw new Error("ระดับการปฏิเสธไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  const isHrAdmin = !!profile && (profile.role === "hr" || profile.role === "admin");

  // Authorize: HR/Admin may reject at any level. A designated approver may
  // reject their own stage (chair/director/dean) when the request sits there.
  const { data: cur, error: curErr } = await supabase
    .from("leave_requests").select("employee_id, status").eq("id", requestId).single();
  if (curErr || !cur) throw new Error("ไม่พบคำขอลา");

  if (!isHrAdmin) {
    const STAGE_FOR_LEVEL: Record<string, string> = {
      chair: "awaiting_chair", director: "awaiting_director", dean: "awaiting_dean",
    };
    const reqStage = STAGE_FOR_LEVEL[level];
    if (!reqStage) throw new Error("Forbidden: HR/Admin only");
    if (cur.status !== reqStage) {
      throw new Error("ไม่สามารถดำเนินการได้ (สถานะไม่ถูกต้อง กรุณารีเฟรช)");
    }
    const { allowed } = await resolveStageSigners(
      supabase, level as "chair" | "director" | "dean", cur.employee_id, user.id,
    );
    if (!allowed.includes(user.id)) {
      throw new Error("Forbidden: คุณไม่มีสิทธิ์ปฏิเสธขั้นตอนนี้");
    }
  }
  const actorId = user.id;

  // Writes via admin client — a non-HR approver passes the app-level check
  // above but has no RLS write access (same as runLeaveStage).
  const db = getAdminClient();

  const { data: updated, error } = await db
    .from("leave_requests")
    .update({
      status: "rejected" as const,
      approver_id: actorId,
      ...(sanitizedReason ? { reason: sanitizedReason } : {}),
    })
    .eq("id", requestId)
    .in("status", ["pending", "awaiting_chair", "awaiting_director", "awaiting_dean", "approved", "awaiting_university"])
    .select("employee_id, leave_type_id, working_days, total_days")
    .single();

  if (error || !updated) {
    throw new Error("ไม่สามารถปฏิเสธคำขอลาได้ (สถานะอาจเปลี่ยนไปแล้ว)");
  }

  // Release the balance reserved at submission (W0)
  await releaseLeaveBalance(
    db,
    updated.employee_id,
    updated.leave_type_id,
    updated.working_days ?? updated.total_days,
    currentFiscalYear(),
  );

  // Record the rejection on the document tracking row
  await db
    .from("document_tracking")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: actorId,
      reject_reason: sanitizedReason,
      reject_level: level,
    })
    .eq("reference_id", requestId);

  const { data: lt } = await db
    .from("leave_types").select("name").eq("id", updated.leave_type_id).single();
  const ltName = lt?.name ?? "ลา";
  const levelLabel =
    level === "chair" ? "ประธานสาขาวิชา"
    : level === "director" ? "ผู้อำนวยการ"
    : level === "dean" ? "คณบดี"
    : level === "president" ? "อธิการบดี"
    : "HR";
  const msg = sanitizedReason
    ? `คำขอ${ltName}ของคุณไม่ผ่านการพิจารณา (${levelLabel}) เหตุผล: ${sanitizedReason}`
    : `คำขอ${ltName}ของคุณไม่ผ่านการพิจารณา (${levelLabel})`;

  await logAudit(db, actorId, "reject_leave_at_stage", "leave_request", requestId, {
    level,
    reason: sanitizedReason,
  });
  await createNotificationInternal(db, updated.employee_id, "leave_rejected", msg);

  revalidatePath("/dashboard/leaves");
  revalidatePath(`/dashboard/leaves/${requestId}`);
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/hr/documents");
  revalidatePath("/dashboard/approvals/leaves");
  revalidatePath("/dashboard/approvals/documents");
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
      const cap = await getVacationAccumulationCap(supabase, emp?.employee_type ?? null);
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

  // M3: vacation cap by employee_type — fetch once, look up per employee
  const { data: empTypeRows } = await supabase
    .from("employee_types").select("name, vacation_accumulation_cap");
  const capByEmployeeType = new Map(
    (empTypeRows ?? []).map((r) => [r.name, r.vacation_accumulation_cap]),
  );

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
        const cap = capByEmployeeType.get(emp.employee_type ?? "") ?? 0;
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

  // M3: vacation cap by employee_type (one-shot fetch, look up per row)
  const { data: empTypeRows } = await supabase
    .from("employee_types").select("name, vacation_accumulation_cap");
  const capByEmployeeType = new Map(
    (empTypeRows ?? []).map((r) => [r.name, r.vacation_accumulation_cap]),
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
        const cap = capByEmployeeType.get(prof.employee_type ?? "") ?? 0;
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

// ═══════════════════════════════════════════════════════════
//  Completed-leave cancellation flow (workflow ลายเซ็นแยก)
//  ใบลาที่ completed แล้วต้องยื่น "ใบขอยกเลิก" → ผอ. → คณบดี →
//  ส่งอธิการบดี(รับทราบ, ไม่มีเอกสารกลับ) → คืน balance + ใบเดิม=cancelled
// ═══════════════════════════════════════════════════════════

/** พนักงาน(เจ้าของ)/HR ยื่นคำขอยกเลิกใบลาที่ส่งมหาวิทยาลัย/เสร็จสิ้นแล้ว
 *  `partial` = ยกเลิกบางช่วง (ช่วงต่อเนื่องเดียวภายในใบ) — ตามแบบฟอร์ม
 *  ราชการ "ขอยกเลิกวันลา ตั้งแต่…ถึง…รวม…วัน" · ไม่ส่ง = ยกเลิกทั้งใบ */
export async function createLeaveCancellationRequest(
  leaveRequestId: string,
  reason: string,
  partial?: { startDate: string; endDate: string },
) {
  if (!UUID_RE.test(leaveRequestId)) throw new Error("รหัสคำขอลาไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผลการยกเลิก", 1000);
  if (!sanitizedReason) throw new Error("กรุณาระบุเหตุผลการยกเลิก");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  const isHr = profile?.role === "hr" || profile?.role === "admin";

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("id, employee_id, status, leave_type_id, start_date, end_date, working_days, total_days")
    .eq("id", leaveRequestId)
    .single();
  if (!leave) throw new Error("ไม่พบใบลานี้");
  if (leave.status !== "completed" && leave.status !== "awaiting_university") {
    throw new Error(
      "flow นี้ใช้กับใบลาที่ส่งมหาวิทยาลัยหรือเสร็จสิ้นแล้ว — ใบที่ยังอยู่ระดับคณะใช้ปุ่มยกเลิกคำขอได้โดยตรง",
    );
  }
  if (!isHr && leave.employee_id !== user.id) {
    throw new Error("Forbidden: ยื่นยกเลิกได้เฉพาะใบลาของตัวเอง");
  }

  // ── Partial-range validation + working-day computation ──
  let cancelWd: number | null = null;
  if (partial) {
    const { startDate, endDate } = partial;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
    }
    if (endDate < startDate) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
    if (startDate < leave.start_date || endDate > leave.end_date) {
      throw new Error("ช่วงที่ขอยกเลิกต้องอยู่ภายในช่วงวันลาเดิม");
    }
    cancelWd = await calculateWorkingDays(supabase, startDate, endDate);
    if (cancelWd <= 0) {
      throw new Error("ช่วงที่ขอยกเลิกไม่มีวันทำการ — ไม่มีสิทธิ์ที่จะคืน");
    }
    const leaveWd = Number(leave.working_days ?? leave.total_days ?? 0);
    if (cancelWd >= leaveWd) {
      // ครอบทั้งใบ → ปฏิบัติเหมือนยกเลิกทั้งใบ
      partial = undefined;
      cancelWd = null;
    }
  }

  // กันยื่นซ้ำ (มีคำขอยกเลิกที่ยังไม่จบและไม่ถูกปฏิเสธ)
  const { data: existing } = await supabase
    .from("leave_cancellation_requests")
    .select("id")
    .eq("leave_request_id", leaveRequestId)
    .not("status", "in", "(rejected,cancelled)")
    .maybeSingle();
  if (existing) throw new Error("มีคำขอยกเลิกใบลานี้อยู่แล้ว");

  const { data: created, error } = await supabase
    .from("leave_cancellation_requests")
    .insert({
      leave_request_id: leaveRequestId,
      requested_by: user.id,
      reason: sanitizedReason,
      status: "pending",
      cancel_start_date: partial?.startDate ?? null,
      cancel_end_date: partial?.endDate ?? null,
      cancel_working_days: cancelWd,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[leave-actions] create cancellation failed:", error?.message);
    throw new Error("ไม่สามารถยื่นคำขอยกเลิกได้");
  }

  // document_tracking row สำหรับ routing (reuse, doc_type=leave_cancellation)
  await getAdminClient()
    .from("document_tracking")
    .insert({ reference_id: created.id, document_type: "leave_cancellation" });

  await logAudit(supabase, user.id, "create_leave_cancellation", "leave_cancellation_request", created.id, {
    leave_request_id: leaveRequestId,
  });

  // แจ้ง HR/Admin
  const [{ data: ltInfo }, { data: empInfo }] = await Promise.all([
    supabase.from("leave_types").select("name").eq("id", leave.leave_type_id).single(),
    supabase.from("profiles").select("full_name").eq("id", leave.employee_id).single(),
  ]);
  const msg = `มีคำขอยกเลิกใบ${ltInfo?.name ?? "ลา"}จาก ${empInfo?.full_name ?? "พนักงาน"} รอดำเนินการ`;
  const { data: hrUsers } = await supabase
    .from("profiles").select("id").in("role", ["hr", "admin"]).neq("id", user.id);
  if (hrUsers) {
    await Promise.all(
      hrUsers.map((hr) => createNotificationInternal(supabase, hr.id, "new_leave_request", msg)),
    );
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath(`/dashboard/leaves/${leaveRequestId}`);
  revalidatePath("/dashboard/hr/leaves");
  return { success: true, id: created.id };
}

interface CancelStageConfig {
  from: ReqStatus[];
  to?: ReqStatus;
  trackingDates?: string[];
  audit: string;
  notifyMsg: (ltName: string) => string;
  /** Signature step the designated approver may perform (in addition to
   *  HR/Admin) — mirrors runLeaveStage. Dean includes acting delegates. */
  signerRole?: "director" | "dean";
}

/** Shared step for the cancellation workflow — HR/Admin any step; the
 *  designated director/dean may perform their own signature step. */
async function runCancellationStage(cancellationId: string, cfg: CancelStageConfig): Promise<void> {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอยกเลิกไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  const isHrAdmin = !!profile && (profile.role === "hr" || profile.role === "admin");

  // Fetch first so signature steps can be authorized before mutating.
  const { data: cur, error: curErr } = await supabase
    .from("leave_cancellation_requests")
    .select("leave_request_id, status")
    .eq("id", cancellationId)
    .single();
  if (curErr || !cur) throw new Error("ไม่พบคำขอยกเลิก");
  if (!cfg.from.includes(cur.status)) {
    throw new Error("ไม่สามารถดำเนินการได้ (สถานะไม่ถูกต้อง กรุณารีเฟรช)");
  }

  if (!isHrAdmin) {
    if (!cfg.signerRole) throw new Error("Forbidden: HR/Admin only");
    const { data: leaveRow } = await supabase
      .from("leave_requests")
      .select("employee_id")
      .eq("id", cur.leave_request_id)
      .single();
    const { allowed } = await resolveStageSigners(
      supabase, cfg.signerRole, leaveRow?.employee_id ?? "", user.id,
    );
    if (!allowed.includes(user.id)) {
      throw new Error("Forbidden: คุณไม่มีสิทธิ์ลงนามขั้นตอนนี้");
    }
  }
  const actorId = user.id;

  // Writes via admin client — a non-HR approver has no RLS write access
  // (same reason as runLeaveStage).
  const db = getAdminClient();

  const row: { leave_request_id: string } = { leave_request_id: cur.leave_request_id };
  if (cfg.to) {
    const { data, error } = await db
      .from("leave_cancellation_requests")
      .update({ status: cfg.to, updated_at: new Date().toISOString() })
      .eq("id", cancellationId)
      .in("status", cfg.from)
      .select("leave_request_id")
      .single();
    if (error || !data) throw new Error("ไม่สามารถดำเนินการได้ (สถานะอาจเปลี่ยนไปแล้ว)");
    row.leave_request_id = data.leave_request_id;
  }

  if (cfg.trackingDates?.length) {
    const now = new Date().toISOString();
    const tpatch: Record<string, unknown> = {};
    for (const c of cfg.trackingDates) tpatch[c] = now;
    await db
      .from("document_tracking")
      .update(tpatch as Database["public"]["Tables"]["document_tracking"]["Update"])
      .eq("reference_id", cancellationId);
  }

  await logAudit(db, actorId, cfg.audit, "leave_cancellation_request", cancellationId);

  const { data: leave } = await db
    .from("leave_requests")
    .select("employee_id, leave_type_id")
    .eq("id", row.leave_request_id)
    .single();
  if (leave) {
    const { data: lt } = await db
      .from("leave_types").select("name").eq("id", leave.leave_type_id).single();
    await createNotificationInternal(
      db, leave.employee_id, "leave_status_update", cfg.notifyMsg(lt?.name ?? "ลา"),
    );
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/hr/documents");
}

export async function routeCancellationToDirector(id: string) {
  return runCancellationStage(id, {
    from: ["pending"], to: "awaiting_director",
    trackingDates: ["sent_to_director_date"],
    audit: "cancel_route_director",
    notifyMsg: (lt) => `คำขอยกเลิกใบ${lt}ของคุณถูกส่งให้ผู้อำนวยการลงนาม`,
  });
}
export async function markCancellationDirectorSigned(id: string) {
  return runCancellationStage(id, {
    from: ["awaiting_director"],
    trackingDates: ["director_signed_date"],
    signerRole: "director",
    audit: "cancel_director_signed",
    notifyMsg: (lt) => `ผู้อำนวยการลงนามคำขอยกเลิกใบ${lt}ของคุณแล้ว`,
  });
}
export async function routeCancellationToDean(id: string) {
  return runCancellationStage(id, {
    from: ["awaiting_director"], to: "awaiting_dean",
    trackingDates: ["sent_to_dean_date"],
    audit: "cancel_route_dean",
    notifyMsg: (lt) => `คำขอยกเลิกใบ${lt}ของคุณถูกส่งให้คณบดีลงนาม`,
  });
}
export async function markCancellationDeanSigned(id: string) {
  return runCancellationStage(id, {
    from: ["awaiting_dean"], to: "approved",
    trackingDates: ["dean_signed_date"],
    signerRole: "dean",
    audit: "cancel_dean_signed",
    notifyMsg: (lt) => `คณบดีลงนามคำขอยกเลิกใบ${lt}ของคุณแล้ว`,
  });
}
export async function sendCancellationToPresident(id: string) {
  return runCancellationStage(id, {
    from: ["approved"], to: "awaiting_university",
    trackingDates: ["sent_to_president_date"],
    audit: "cancel_send_president",
    notifyMsg: (lt) => `คำขอยกเลิกใบ${lt}ของคุณถูกส่งให้อธิการบดีพิจารณา`,
  });
}

/** ขั้นสุดท้าย: อธิการบดีรับทราบ → คืน balance + อัปเดตใบลาเดิม
 *  (ยกเลิกทั้งใบ → cancelled · ยกเลิกบางช่วง → ลด working_days ใบเดิม
 *  คงวันที่ไว้เป็นประวัติ ตามแบบฟอร์มราชการ) */
export async function completeCancellation(cancellationId: string) {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอยกเลิกไม่ถูกต้อง");
  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  const { data: cancel, error } = await supabase
    .from("leave_cancellation_requests")
    .update({ status: "completed", approver_id: actorId, updated_at: new Date().toISOString() })
    .eq("id", cancellationId)
    .in("status", ["awaiting_university"])
    .select("leave_request_id, cancel_start_date, cancel_end_date, cancel_working_days")
    .single();
  if (error || !cancel) throw new Error("ไม่สามารถดำเนินการได้ (สถานะอาจเปลี่ยนไปแล้ว)");

  const { data: leave } = await supabase
    .from("leave_requests")
    .select("id, employee_id, leave_type_id, working_days, total_days, start_date, status")
    .eq("id", cancel.leave_request_id)
    .single();

  // ใบลาที่ยกเลิกได้ผ่าน flow นี้: completed หรือ awaiting_university
  if (leave && (leave.status === "completed" || leave.status === "awaiting_university")) {
    const fy = currentFiscalYear(new Date(leave.start_date));
    const fullWd = Number(leave.working_days ?? leave.total_days ?? 0);
    const isPartial = cancel.cancel_start_date != null && cancel.cancel_working_days != null;
    const releaseWd = isPartial
      ? Math.min(Number(cancel.cancel_working_days), fullWd)
      : fullWd;

    await releaseLeaveBalance(
      getAdminClient(),
      leave.employee_id,
      leave.leave_type_id,
      releaseWd,
      fy,
    );

    if (isPartial) {
      // คงใบเดิมไว้ (วันที่เดิมเป็นประวัติ) แต่ลดวันทำการที่นับใช้สิทธิ์
      await getAdminClient()
        .from("leave_requests")
        .update({ working_days: fullWd - releaseWd })
        .eq("id", leave.id);
    } else {
      await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", leave.id)
        .eq("status", leave.status);
    }
  }

  await supabase
    .from("document_tracking")
    .update({ president_signed_date: new Date().toISOString() })
    .eq("reference_id", cancellationId);

  await logAudit(supabase, actorId, "complete_leave_cancellation", "leave_cancellation_request", cancellationId, {
    leave_request_id: cancel.leave_request_id,
  });

  if (leave) {
    const { data: lt } = await supabase
      .from("leave_types").select("name").eq("id", leave.leave_type_id).single();
    await createNotificationInternal(
      supabase, leave.employee_id, "leave_status_update",
      `คำขอยกเลิกใบ${lt?.name ?? "ลา"}ของคุณได้รับอนุมัติครบ — ใบลาถูกยกเลิกและคืนสิทธิ์แล้ว`,
    );
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/hr/documents");
}

/** ปฏิเสธคำขอยกเลิก (ทุกขั้น) — ใบลาเดิมคง completed */
export async function rejectCancellationAtStage(
  cancellationId: string,
  level: "hr" | "director" | "dean" | "president",
  reason: string,
) {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอยกเลิกไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผล", 500);
  if (!["hr", "director", "dean", "president"].includes(level)) {
    throw new Error("ระดับการปฏิเสธไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  const { data: updated, error } = await supabase
    .from("leave_cancellation_requests")
    .update({ status: "rejected" as const, approver_id: actorId, updated_at: new Date().toISOString() })
    .eq("id", cancellationId)
    .in("status", ["pending", "awaiting_director", "awaiting_dean", "approved", "awaiting_university"])
    .select("leave_request_id")
    .single();
  if (error || !updated) throw new Error("ไม่สามารถปฏิเสธคำขอยกเลิกได้ (สถานะอาจเปลี่ยนไปแล้ว)");

  await supabase
    .from("document_tracking")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: actorId,
      reject_reason: sanitizedReason,
      reject_level: level,
    })
    .eq("reference_id", cancellationId);

  await logAudit(supabase, actorId, "reject_leave_cancellation", "leave_cancellation_request", cancellationId, {
    level, reason: sanitizedReason,
  });

  const { data: leave } = await supabase
    .from("leave_requests").select("employee_id, leave_type_id").eq("id", updated.leave_request_id).single();
  if (leave) {
    const { data: lt } = await supabase
      .from("leave_types").select("name").eq("id", leave.leave_type_id).single();
    const msg = sanitizedReason
      ? `คำขอยกเลิกใบ${lt?.name ?? "ลา"}ของคุณไม่ผ่านการพิจารณา เหตุผล: ${sanitizedReason}`
      : `คำขอยกเลิกใบ${lt?.name ?? "ลา"}ของคุณไม่ผ่านการพิจารณา`;
    await createNotificationInternal(supabase, leave.employee_id, "leave_rejected", msg);
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/hr/documents");
}
