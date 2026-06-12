"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { createNotificationInternal } from "./notification-actions";
import { UUID_RE, validateRequestDates, validateEmployeeExists, validateTextField, sanitizeText } from "./validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import type { Database } from "@/types/supabase";

// D5: service-role client for document_tracking writes from employee-owned
// flows (employee submits a travel request → document_tracking row needs
// to be created but the table's INSERT policy is hr/admin-only).
function getAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function createTravelDocumentTracking(
  admin: SupabaseClient<Database>,
  requestId: string,
): Promise<void> {
  const { error } = await admin
    .from("document_tracking")
    .insert({ reference_id: requestId, document_type: "travel" });
  if (error) {
    console.error("[travel-actions] create document_tracking failed:", error.message);
  }
}

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

  // D5: every digital travel submission gets a document_tracking row so the
  // 2-level signature workflow has somewhere to write its dates.
  await createTravelDocumentTracking(getAdminClient(), request.id);

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

  // D5: paper channel also gets the tracking row server-side. The paper-
  // travel-form's manual createDocumentTracking call is removed in commit 3.
  await createTravelDocumentTracking(getAdminClient(), request.id);

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

/* ── D5: legacy single-step approve/reject/complete/updateScanned were
       removed in favour of the workflow stage actions below. UI quick
       buttons in hr-travel-client.tsx and travel-detail-actions.tsx
       were migrated in the same commit. */

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

// ═══════════════════════════════════════════════════════════════════
//  D5 — 2-level signature workflow (mirrors leave-actions runLeaveStage)
//
//  Clone, not extract: leave's runLeaveStage has 3 leave-specific
//  couplings (table name, type-label join, balance release). Keeping the
//  travel pipeline self-contained avoids forcing a 6+ arg config object
//  for a 2nd consumer. ~60 lines duplicated by design.
// ═══════════════════════════════════════════════════════════════════

type TravelStatus = Database["public"]["Tables"]["travel_requests"]["Row"]["status"];

async function requireHrAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR/Admin only");
  }
  return user.id;
}

interface TravelStageConfig {
  from: TravelStatus[];
  to?: TravelStatus;
  trackingDates?: string[];
  trackingExtra?: Record<string, unknown>;
  audit: string;
  notifyType?: string;
  notifyMsg?: string;
  /** Extra fields to patch on travel_requests (e.g. approver_id, order_document_url). */
  requestExtra?: Record<string, unknown>;
}

async function runTravelStage(requestId: string, cfg: TravelStageConfig): Promise<void> {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  let row: { employee_id: string };
  if (cfg.to || cfg.requestExtra) {
    const patch = { ...(cfg.requestExtra ?? {}) } as Record<string, unknown>;
    if (cfg.to) patch.status = cfg.to;
    const { data, error } = await supabase
      .from("travel_requests")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", requestId)
      .in("status", cfg.from)
      .select("employee_id")
      .single();
    if (error || !data) throw new Error("ไม่สามารถดำเนินการได้ (สถานะอาจเปลี่ยนไปแล้ว กรุณารีเฟรช)");
    row = data;
  } else {
    const { data, error } = await supabase
      .from("travel_requests")
      .select("employee_id, status")
      .eq("id", requestId)
      .single();
    if (error || !data || !cfg.from.includes(data.status)) {
      throw new Error("ไม่สามารถดำเนินการได้ (สถานะไม่ถูกต้อง)");
    }
    row = { employee_id: data.employee_id };
  }

  if (cfg.trackingDates?.length || cfg.trackingExtra) {
    const now = new Date().toISOString();
    const tpatch: Record<string, unknown> = { ...(cfg.trackingExtra ?? {}) };
    for (const c of cfg.trackingDates ?? []) tpatch[c] = now;
    const { error: terr } = await supabase
      .from("document_tracking")
      .update(tpatch as Database["public"]["Tables"]["document_tracking"]["Update"])
      .eq("reference_id", requestId)
      .eq("document_type", "travel");
    if (terr) console.error("[travel-actions] tracking update failed:", terr.message);
  }

  await logAudit(supabase, actorId, cfg.audit, "travel_request", requestId);

  if (cfg.notifyType && cfg.notifyMsg) {
    await createNotificationInternal(supabase, row.employee_id, cfg.notifyType, cfg.notifyMsg);
  }

  revalidatePath("/dashboard/travel");
  revalidatePath(`/dashboard/travel/${requestId}`);
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/hr/documents");
  revalidatePath("/dashboard/approvals/travel");
}

/** Step 1: HR ส่งคำสั่งเดินทางให้ผู้อำนวยการลงนาม */
export async function routeToTravelDirector(requestId: string) {
  return runTravelStage(requestId, {
    from: ["pending"],
    to: "awaiting_director",
    trackingDates: ["sent_to_director_date"],
    audit: "route_travel_to_director",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณถูกส่งให้ผู้อำนวยการลงนามแล้ว",
  });
}

/** Step 2: ผู้อำนวยการลงนาม */
export async function markTravelDirectorSigned(requestId: string) {
  return runTravelStage(requestId, {
    from: ["awaiting_director"],
    trackingDates: ["director_signed_date"],
    audit: "travel_director_signed",
    notifyType: "travel_status_update",
    notifyMsg: "ผู้อำนวยการลงนามคำสั่งเดินทางของคุณแล้ว",
  });
}

/** Step 3: HR ส่งให้คณบดีลงนาม */
export async function routeToTravelDean(requestId: string) {
  return runTravelStage(requestId, {
    from: ["awaiting_director"],
    to: "awaiting_dean",
    trackingDates: ["sent_to_dean_date"],
    audit: "route_travel_to_dean",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณถูกส่งให้คณบดีลงนามแล้ว",
  });
}

/** Step 4: คณบดีลงนาม → อนุมัติ */
export async function markTravelDeanSigned(requestId: string) {
  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);
  return runTravelStage(requestId, {
    from: ["awaiting_dean"],
    to: "approved",
    trackingDates: ["dean_signed_date"],
    audit: "travel_dean_signed",
    notifyType: "travel_approved",
    notifyMsg: "คำขอเดินทางของคุณได้รับการอนุมัติแล้ว (คณบดีลงนามครบ)",
    requestExtra: { approver_id: actorId },
  });
}

/** Step 5: HR สแกน + อัปโหลดคำสั่งที่ลงนามครบระดับคณะ */
export async function markTravelScanned(requestId: string, scannedUrl: string) {
  const url = validateTextField(scannedUrl, "ไฟล์เอกสาร", 500);
  return runTravelStage(requestId, {
    from: ["approved"],
    trackingDates: ["scanned_upload_date"],
    trackingExtra: { scanned_document_url: url },
    // Dual-write to legacy column so existing detail page still finds the URL.
    requestExtra: { order_document_url: url },
    audit: "travel_scanned",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณถูกสแกนเก็บเข้าแฟ้มแล้ว",
  });
}

/** Step 6a (optional): HR ส่งคำสั่งให้มหาวิทยาลัย/อธิการบดีลงนาม */
export async function sendTravelToUniversity(requestId: string) {
  return runTravelStage(requestId, {
    from: ["approved"],
    to: "awaiting_university",
    trackingDates: ["sent_to_president_date"],
    audit: "send_travel_to_university",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณถูกส่งให้มหาวิทยาลัย/อธิการบดีลงนามแล้ว",
  });
}

/** Step 6b: HR รับเอกสารคืน (อธิการบดีลงนาม) + อัปโหลดเก็บแฟ้ม → จบ */
export async function receiveTravelFromUniversity(requestId: string, signedUrl: string) {
  const url = validateTextField(signedUrl, "ไฟล์เอกสารที่ลงนาม", 500);
  return runTravelStage(requestId, {
    from: ["awaiting_university"],
    to: "completed",
    trackingDates: ["president_signed_date"],
    trackingExtra: { president_document_url: url },
    audit: "receive_travel_from_university",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณรับเอกสารคืนจากมหาวิทยาลัย (ลงนามครบ) — เสร็จสิ้นกระบวนการ",
  });
}

/** Step 6 (faculty-only path): จบกระบวนการที่ระดับคณะ */
export async function completeTravelAtFaculty(requestId: string) {
  return runTravelStage(requestId, {
    from: ["approved"],
    to: "completed",
    audit: "complete_travel_faculty",
    notifyType: "travel_status_update",
    notifyMsg: "คำสั่งเดินทางของคุณเสร็จสิ้นกระบวนการแล้ว",
  });
}

/** Reject at any stage (HR validation / ผอ. / คณบดี / อธิการบดี). */
export async function rejectTravelAtStage(
  requestId: string,
  level: "hr" | "director" | "dean" | "president",
  reason: string,
) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผล", 500);
  if (!["hr", "director", "dean", "president"].includes(level)) {
    throw new Error("ระดับการปฏิเสธไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  const { data: updated, error } = await supabase
    .from("travel_requests")
    .update({
      status: "rejected" as const,
      approver_id: actorId,
    })
    .eq("id", requestId)
    .in("status", ["pending", "awaiting_director", "awaiting_dean", "approved", "awaiting_university"])
    .select("employee_id")
    .single();

  if (error || !updated) {
    throw new Error("ไม่สามารถปฏิเสธคำขอเดินทางได้ (สถานะอาจเปลี่ยนไปแล้ว)");
  }

  // Record the rejection on the document tracking row
  await supabase
    .from("document_tracking")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: actorId,
      reject_reason: sanitizedReason,
      reject_level: level,
    })
    .eq("reference_id", requestId)
    .eq("document_type", "travel");

  const levelLabel =
    level === "director" ? "ผู้อำนวยการ"
    : level === "dean" ? "คณบดี"
    : level === "president" ? "อธิการบดี"
    : "HR";
  const msg = sanitizedReason
    ? `คำขอเดินทางของคุณไม่ผ่านการพิจารณา (${levelLabel}) เหตุผล: ${sanitizedReason}`
    : `คำขอเดินทางของคุณไม่ผ่านการพิจารณา (${levelLabel})`;

  await logAudit(supabase, actorId, "reject_travel_at_stage", "travel_request", requestId, {
    level,
    reason: sanitizedReason,
  });
  await createNotificationInternal(supabase, updated.employee_id, "travel_rejected", msg);

  revalidatePath("/dashboard/travel");
  revalidatePath(`/dashboard/travel/${requestId}`);
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/hr/documents");
  revalidatePath("/dashboard/approvals/travel");
}

// ═══════════════════════════════════════════════════════════════════
//  D5 — Post-completion cancellation workflow
//  (mirrors leave_cancellation_requests pattern from migration 20260601)
// ═══════════════════════════════════════════════════════════════════

export async function createTravelCancellationRequest(
  travelRequestId: string,
  reason: string,
) {
  if (!UUID_RE.test(travelRequestId)) throw new Error("รหัสคำขอเดินทางไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผล", 1000);
  if (!sanitizedReason) throw new Error("กรุณาระบุเหตุผลในการยกเลิก");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  // Parent travel must be completed (terminal). RLS additionally requires
  // requested_by = caller AND caller owns the travel request — match here
  // for a clearer error than the RLS rejection.
  const { data: parent } = await supabase
    .from("travel_requests")
    .select("status, employee_id")
    .eq("id", travelRequestId)
    .single();
  if (!parent) throw new Error("ไม่พบคำขอเดินทางนี้");
  if (parent.status !== "completed") {
    throw new Error("ยื่นคำขอยกเลิกได้เฉพาะคำสั่งเดินทางที่เสร็จสิ้นแล้ว");
  }

  const { data: inserted, error } = await supabase
    .from("travel_cancellation_requests")
    .insert({
      travel_request_id: travelRequestId,
      requested_by: user.id,
      reason: sanitizedReason,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error("ไม่สามารถยื่นคำขอยกเลิกได้");

  // tracking row for the cancellation workflow
  await createTravelCancellationDocumentTracking(getAdminClient(), inserted.id);

  // Notify HR/Admin
  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"]);
  const msg = "มีคำขอยกเลิกคำสั่งเดินทาง — รอตรวจสอบและเริ่มเดินเอกสาร";
  if (hrUsers) {
    await Promise.all(
      hrUsers.map((hr) =>
        createNotificationInternal(supabase, hr.id, "new_travel_request", msg),
      ),
    );
  }

  await logAudit(supabase, user.id, "create_travel_cancellation", "travel_cancellation_request", inserted.id, {
    travel_request_id: travelRequestId,
  });

  revalidatePath(`/dashboard/travel/${travelRequestId}`);
  revalidatePath("/dashboard/hr/travel");
  return { success: true, id: inserted.id };
}

async function createTravelCancellationDocumentTracking(
  admin: SupabaseClient<Database>,
  cancellationId: string,
): Promise<void> {
  const { error } = await admin
    .from("document_tracking")
    .insert({ reference_id: cancellationId, document_type: "travel_cancellation" });
  if (error) {
    console.error("[travel-actions] create cancellation tracking failed:", error.message);
  }
}

type CancelStatus = Database["public"]["Tables"]["travel_cancellation_requests"]["Row"]["status"];

interface CancelStageConfig {
  from: CancelStatus[];
  to?: CancelStatus;
  trackingDates?: string[];
  trackingExtra?: Record<string, unknown>;
  audit: string;
  notifyMsg?: string;
}

async function runTravelCancellationStage(cancellationId: string, cfg: CancelStageConfig): Promise<void> {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  let row: { requested_by: string; travel_request_id: string };
  if (cfg.to) {
    const { data, error } = await supabase
      .from("travel_cancellation_requests")
      .update({ status: cfg.to })
      .eq("id", cancellationId)
      .in("status", cfg.from)
      .select("requested_by, travel_request_id")
      .single();
    if (error || !data) throw new Error("ไม่สามารถดำเนินการได้ (สถานะอาจเปลี่ยนไปแล้ว)");
    row = data;
  } else {
    const { data, error } = await supabase
      .from("travel_cancellation_requests")
      .select("requested_by, travel_request_id, status")
      .eq("id", cancellationId)
      .single();
    if (error || !data || !cfg.from.includes(data.status)) {
      throw new Error("ไม่สามารถดำเนินการได้ (สถานะไม่ถูกต้อง)");
    }
    row = { requested_by: data.requested_by, travel_request_id: data.travel_request_id };
  }

  if (cfg.trackingDates?.length || cfg.trackingExtra) {
    const now = new Date().toISOString();
    const tpatch: Record<string, unknown> = { ...(cfg.trackingExtra ?? {}) };
    for (const c of cfg.trackingDates ?? []) tpatch[c] = now;
    const { error: terr } = await supabase
      .from("document_tracking")
      .update(tpatch as Database["public"]["Tables"]["document_tracking"]["Update"])
      .eq("reference_id", cancellationId)
      .eq("document_type", "travel_cancellation");
    if (terr) console.error("[travel-actions] cancellation tracking update failed:", terr.message);
  }

  await logAudit(supabase, actorId, cfg.audit, "travel_cancellation_request", cancellationId);

  if (cfg.notifyMsg) {
    await createNotificationInternal(supabase, row.requested_by, "travel_status_update", cfg.notifyMsg);
  }

  revalidatePath(`/dashboard/travel/${row.travel_request_id}`);
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/hr/documents");
}

export async function routeTravelCancellationToDirector(cancellationId: string) {
  return runTravelCancellationStage(cancellationId, {
    from: ["pending"],
    to: "awaiting_director",
    trackingDates: ["sent_to_director_date"],
    audit: "route_travel_cancel_to_director",
    notifyMsg: "คำขอยกเลิกคำสั่งเดินทางของคุณถูกส่งให้ผู้อำนวยการลงนาม",
  });
}

export async function markTravelCancellationDirectorSigned(cancellationId: string) {
  return runTravelCancellationStage(cancellationId, {
    from: ["awaiting_director"],
    trackingDates: ["director_signed_date"],
    audit: "travel_cancel_director_signed",
    notifyMsg: "ผู้อำนวยการลงนามคำขอยกเลิกคำสั่งเดินทางของคุณแล้ว",
  });
}

export async function routeTravelCancellationToDean(cancellationId: string) {
  return runTravelCancellationStage(cancellationId, {
    from: ["awaiting_director"],
    to: "awaiting_dean",
    trackingDates: ["sent_to_dean_date"],
    audit: "route_travel_cancel_to_dean",
    notifyMsg: "คำขอยกเลิกคำสั่งเดินทางของคุณถูกส่งให้คณบดีลงนาม",
  });
}

export async function markTravelCancellationDeanSigned(cancellationId: string) {
  return runTravelCancellationStage(cancellationId, {
    from: ["awaiting_dean"],
    to: "approved",
    trackingDates: ["dean_signed_date"],
    audit: "travel_cancel_dean_signed",
    notifyMsg: "คณบดีลงนามคำขอยกเลิกคำสั่งเดินทางของคุณแล้ว",
  });
}

export async function sendTravelCancellationToPresident(cancellationId: string) {
  return runTravelCancellationStage(cancellationId, {
    from: ["approved"],
    to: "awaiting_university",
    trackingDates: ["sent_to_president_date"],
    audit: "send_travel_cancel_to_president",
    notifyMsg: "คำขอยกเลิกคำสั่งเดินทางของคุณถูกส่งให้อธิการบดี",
  });
}

/** Final stage: marks the cancellation complete AND flips the parent
 *  travel_requests.status to 'cancelled'. */
export async function completeTravelCancellation(cancellationId: string) {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  const { data: cancel, error: cancelErr } = await supabase
    .from("travel_cancellation_requests")
    .update({ status: "completed" })
    .eq("id", cancellationId)
    .in("status", ["awaiting_university", "approved"])
    .select("travel_request_id, requested_by")
    .single();
  if (cancelErr || !cancel) {
    throw new Error("ไม่สามารถปิดคำขอยกเลิกได้ (สถานะไม่ถูกต้อง)");
  }

  // Stamp tracking + flip parent travel status to cancelled
  const now = new Date().toISOString();
  await supabase
    .from("document_tracking")
    .update({ president_signed_date: now })
    .eq("reference_id", cancellationId)
    .eq("document_type", "travel_cancellation");

  await supabase
    .from("travel_requests")
    .update({ status: "cancelled" })
    .eq("id", cancel.travel_request_id);

  await logAudit(supabase, actorId, "complete_travel_cancellation", "travel_cancellation_request", cancellationId, {
    travel_request_id: cancel.travel_request_id,
  });
  await createNotificationInternal(
    supabase,
    cancel.requested_by,
    "travel_status_update",
    "คำขอยกเลิกคำสั่งเดินทางของคุณเสร็จสิ้น — คำสั่งเดินทางถูกยกเลิกแล้ว",
  );

  revalidatePath(`/dashboard/travel/${cancel.travel_request_id}`);
  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/hr/documents");
}

export async function rejectTravelCancellationAtStage(
  cancellationId: string,
  level: "hr" | "director" | "dean" | "president",
  reason: string,
) {
  if (!UUID_RE.test(cancellationId)) throw new Error("รหัสคำขอไม่ถูกต้อง");
  const sanitizedReason = validateTextField(reason, "เหตุผล", 500);
  if (!["hr", "director", "dean", "president"].includes(level)) {
    throw new Error("ระดับการปฏิเสธไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const actorId = await requireHrAdmin(supabase);

  const { data: updated, error } = await supabase
    .from("travel_cancellation_requests")
    .update({ status: "rejected", approver_id: actorId })
    .eq("id", cancellationId)
    .in("status", ["pending", "awaiting_director", "awaiting_dean", "approved", "awaiting_university"])
    .select("requested_by, travel_request_id")
    .single();
  if (error || !updated) {
    throw new Error("ไม่สามารถปฏิเสธคำขอยกเลิกได้ (สถานะอาจเปลี่ยนไปแล้ว)");
  }

  await supabase
    .from("document_tracking")
    .update({
      rejected_at: new Date().toISOString(),
      rejected_by: actorId,
      reject_reason: sanitizedReason,
      reject_level: level,
    })
    .eq("reference_id", cancellationId)
    .eq("document_type", "travel_cancellation");

  const levelLabel =
    level === "director" ? "ผู้อำนวยการ"
    : level === "dean" ? "คณบดี"
    : level === "president" ? "อธิการบดี"
    : "HR";
  const msg = sanitizedReason
    ? `คำขอยกเลิกคำสั่งเดินทางของคุณไม่ผ่านการพิจารณา (${levelLabel}) เหตุผล: ${sanitizedReason}`
    : `คำขอยกเลิกคำสั่งเดินทางของคุณไม่ผ่านการพิจารณา (${levelLabel})`;

  await logAudit(supabase, actorId, "reject_travel_cancellation_at_stage", "travel_cancellation_request", cancellationId, {
    level,
    reason: sanitizedReason,
  });
  await createNotificationInternal(supabase, updated.requested_by, "travel_rejected", msg);

  revalidatePath(`/dashboard/travel/${updated.travel_request_id}`);
  revalidatePath("/dashboard/hr/travel");
}
