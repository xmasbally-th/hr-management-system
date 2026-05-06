"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "./notification-actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRequestDates(startDate: string, endDate: string, totalDays: number) {
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
  }
  if (startDate > endDate) {
    throw new Error("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  }
  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    throw new Error("จำนวนวันต้องมากกว่า 0");
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

async function validateEmployeeExists(supabase: Awaited<ReturnType<typeof createClient>>, employeeId: string) {
  if (!UUID_RE.test(employeeId)) {
    throw new Error("รหัสพนักงานไม่ถูกต้อง");
  }
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", employeeId)
    .eq("status", "approved")
    .single();
  if (!data) throw new Error("ไม่พบพนักงานในระบบ หรือบัญชียังไม่ได้รับการอนุมัติ");
}

export async function getMyTravelRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("travel_requests")
    .select(`
      *,
      expenses:travel_expenses(*)
    `)
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการเดินทางได้");
  return data;
}

export async function getAllTravelRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data, error } = await supabase
    .from("travel_requests")
    .select(`
      *,
      employee:profiles!travel_requests_employee_id_fkey(full_name, email, department_id),
      expenses:travel_expenses(*)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการเดินทางทั้งหมดได้");
  return data;
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

  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data: request, error } = await supabase
    .from("travel_requests")
    .insert({
      employee_id: user.id,
      travel_type: input.travel_type,
      title: input.title,
      location: input.location,
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
      expense_category: exp.expense_category,
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

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
      title: input.title,
      location: input.location,
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
      expense_category: exp.expense_category,
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

export async function approveTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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

  await createNotificationInternal(supabase, updated.employee_id, "travel_approved", "คำขอเดินทางราชการของคุณได้รับการอนุมัติแล้ว");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
}

export async function rejectTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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

  await createNotificationInternal(supabase, updated.employee_id, "travel_rejected", "คำขอเดินทางราชการของคุณไม่ได้รับการอนุมัติ");

  revalidatePath("/dashboard/travel");
  revalidatePath("/dashboard/hr/travel");
  revalidatePath("/dashboard/approvals/travel");
}

export async function completeTravelRequest(requestId: string) {
  if (!UUID_RE.test(requestId)) throw new Error("รหัสคำขอไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
