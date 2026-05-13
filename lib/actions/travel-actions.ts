"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "./notification-actions";
import { UUID_RE, validateRequestDates, validateEmployeeExists, validateTextField, sanitizeText } from "./validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

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

export async function getMyTravelRequests(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("travel_requests")
    .select(`
      *,
      expenses:travel_expenses(*)
    `, { count: "exact" })
    .eq("employee_id", user.id);

  if (params?.status && params.status !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("status", params.status as any);
  }

  if (params?.search) {
    query = query.or(`title.ilike.%${params.search}%,location.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการเดินทางได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export async function getAllTravelRequests(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
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
    .from("travel_requests")
    .select(`
      *,
      employee:profiles!travel_requests_employee_id_fkey(full_name, email, department_id),
      expenses:travel_expenses(*)
    `, { count: "exact" });

  if (params?.status && params.status !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("status", params.status as any);
  }

  if (params?.search) {
    query = query.or(`title.ilike.%${params.search}%,location.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการเดินทางทั้งหมดได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

export interface CreateTravelRequestInput {
  travel_type: "training" | "supervision" | "official_contact";
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  total_days: number;
  submission_channel: "digital" | "paper";
  expenses: {
    expense_category: string;
    estimated_amount: number;
  }[];
}

export async function createTravelRequest(input: CreateTravelRequestInput) {
  validateRequestDates(input.start_date, input.end_date, input.total_days);

  const sanitizedTitle = validateTextField(input.title, "ชื่อเรื่อง", 200);
  if (!sanitizedTitle) throw new Error("กรุณาระบุชื่อเรื่อง");
  const sanitizedLocation = validateTextField(input.location, "สถานที่", 200);
  if (!sanitizedLocation) throw new Error("กรุณาระบุสถานที่");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { data: request, error } = await supabase
    .from("travel_requests")
    .insert({
      employee_id: user.id,
      travel_type: input.travel_type,
      title: sanitizedTitle,
      location: sanitizedLocation,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      submission_channel: input.submission_channel,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[travel-actions] Failed to create travel request:", error);
    throw new Error("ไม่สามารถส่งคำขอเดินทางได้");
  }

  if (input.expenses.length > 0 && request) {
    const expenseRows = input.expenses.map((exp) => ({
      travel_request_id: request.id,
      expense_category: sanitizeText(exp.expense_category).substring(0, 100),
      estimated_amount: exp.estimated_amount,
    }));

    const { error: expError } = await supabase
      .from("travel_expenses")
      .insert(expenseRows);

    if (expError) {
      console.error("[travel-actions] Failed to insert expenses:", expError);
    }
  }

  // Notify HR/Manager about new travel request
  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"]);
  if (hrUsers) {
    for (const hr of hrUsers) {
      await createNotificationInternal(supabase, hr.id, "new_travel_request", "มีคำขอเดินทางราชการใหม่รอการอนุมัติ");
    }
  }

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
  return { success: true, id: request.id };
}

export async function createTravelRequestByHr(
  employeeId: string,
  input: Omit<CreateTravelRequestInput, "submission_channel">
) {
  validateRequestDates(input.start_date, input.end_date, input.total_days);

  const sanitizedTitle = validateTextField(input.title, "ชื่อเรื่อง", 200);
  if (!sanitizedTitle) throw new Error("กรุณาระบุชื่อเรื่อง");
  const sanitizedLocation = validateTextField(input.location, "สถานที่", 200);
  if (!sanitizedLocation) throw new Error("กรุณาระบุสถานที่");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  await validateEmployeeExists(supabase, employeeId);

  const { data: request, error } = await supabase
    .from("travel_requests")
    .insert({
      employee_id: employeeId,
      travel_type: input.travel_type,
      title: sanitizedTitle,
      location: sanitizedLocation,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      submission_channel: "paper",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[travel-actions] HR create travel failed:", error);
    throw new Error("ไม่สามารถส่งคำขอเดินทางแทนพนักงานได้");
  }

  if (input.expenses.length > 0 && request) {
    const expenseRows = input.expenses.map((exp) => ({
      travel_request_id: request.id,
      expense_category: sanitizeText(exp.expense_category).substring(0, 100),
      estimated_amount: exp.estimated_amount,
    }));

    const { error: expError } = await supabase
      .from("travel_expenses")
      .insert(expenseRows);

    if (expError) {
      console.error("[travel-actions] HR expenses insert failed:", expError);
    }
  }

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
  return { success: true, id: request.id };
}

/* ── Read: Single travel request (owner OR HR/admin/manager) ────────── */

export async function getTravelRequestById(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  const { data, error } = await supabase
    .from("travel_requests")
    .select(`
      *,
      employee:profiles!travel_requests_employee_id_fkey(id, full_name, email, position_title, department_id),
      approver:profiles!travel_requests_approver_id_fkey(id, full_name, email),
      expenses:travel_expenses(*)
    `)
    .eq("id", requestId)
    .single();

  if (error || !data) throw new Error("ไม่พบข้อมูลคำขอเดินทาง");

  const isOwner = data.employee_id === user.id;
  const isPrivileged = profile && ["hr", "admin", "manager"].includes(profile.role);
  if (!isOwner && !isPrivileged) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return data;
}

/* ── Cancel travel request (owner only, pending status) ──────────────── */

export async function cancelTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("travel_requests")
    .update({ status: "cancelled" as const })
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .eq("status", "pending");

  if (error) throw new Error("ไม่สามารถยกเลิกคำขอเดินทางได้ (อาจถูกอนุมัติแล้ว)");

  await logAudit(supabase, user.id, "cancel_travel", "travel_request", requestId);

  revalidatePath(`/dashboard/travel/${requestId}`);
  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
}

/* ── Upload scanned signed travel order (HR/Admin only) ──────────────── */

export async function updateTravelScannedDocument(requestId: string, scannedPath: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { error } = await supabase
    .from("travel_requests")
    .update({ order_document_url: scannedPath || null })
    .eq("id", requestId);

  if (error) throw new Error("ไม่สามารถบันทึกเอกสารสแกนได้");

  await logAudit(supabase, user.id, "update_travel_scanned_doc", "travel_request", requestId);

  revalidatePath(`/dashboard/travel/${requestId}`);
  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
}

export async function approveTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: updated, error } = await supabase
    .from("travel_requests")
    .update({
      status: "approved" as const,
      approver_id: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("employee_id")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถอนุมัติคำขอเดินทางได้ (อาจถูกดำเนินการแล้ว)");

  await logAudit(supabase, user.id, "approve_travel", "travel_request", requestId);
  await createNotificationInternal(supabase, updated.employee_id, "travel_approved", "คำขอเดินทางราชการของคุณได้รับการอนุมัติแล้ว");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
}

export async function rejectTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: updated, error } = await supabase
    .from("travel_requests")
    .update({
      status: "rejected" as const,
      approver_id: user.id,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("employee_id")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถปฏิเสธคำขอเดินทางได้ (อาจถูกดำเนินการแล้ว)");

  await logAudit(supabase, user.id, "reject_travel", "travel_request", requestId);
  await createNotificationInternal(supabase, updated.employee_id, "travel_rejected", "คำขอเดินทางราชการของคุณไม่ได้รับการอนุมัติ");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
}

export async function completeTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: updated, error } = await supabase
    .from("travel_requests")
    .update({ status: "completed" as const })
    .eq("id", requestId)
    .eq("status", "approved")
    .select("id")
    .single();

  if (error || !updated) throw new Error("ไม่สามารถปิดงานเดินทางได้ (สถานะไม่ใช่ 'อนุมัติแล้ว')");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
}

export async function updateActualExpense(expenseId: string, actualAmount: number) {
  if (!UUID_RE.test(expenseId)) throw new Error("รหัสค่าใช้จ่ายไม่ถูกต้อง");
  if (!Number.isFinite(actualAmount) || actualAmount < 0) {
    throw new Error("จำนวนเงินต้องเป็นตัวเลขที่ไม่ติดลบ");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: expense } = await supabase
    .from("travel_expenses")
    .select("travel_request_id")
    .eq("id", expenseId)
    .single();
  if (!expense) throw new Error("ไม่พบรายการค่าใช้จ่าย");

  const { data: request } = await supabase
    .from("travel_requests")
    .select("status")
    .eq("id", expense.travel_request_id)
    .single();
  if (!request || !["approved", "completed"].includes(request.status)) {
    throw new Error("ไม่สามารถบันทึกค่าใช้จ่ายจริงได้ (สถานะคำขอไม่เหมาะสม)");
  }

  const { error } = await supabase
    .from("travel_expenses")
    .update({ actual_amount: actualAmount })
    .eq("id", expenseId);

  if (error) throw new Error("ไม่สามารถบันทึกค่าใช้จ่ายจริงได้");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
}
