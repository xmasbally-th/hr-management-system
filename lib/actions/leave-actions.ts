"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotificationInternal } from "./notification-actions";

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

export async function getMyLeaveRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name)
    `)
    .eq("employee_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาได้");
  return data;
}

export async function getMyLeaveBalances() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const currentYear = new Date().getFullYear();

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

export async function getAllLeaveRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .select(`
      *,
      leave_type:leave_types(name),
      employee:profiles!leave_requests_employee_id_fkey(full_name, email, department_id)
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาทั้งหมดได้");
  return data;
}

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
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: user.id,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      reason: input.reason,
      contact_number: input.contact_number,
      medical_cert_url: input.medical_cert_url ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      submission_channel: input.submission_channel,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[leave-actions] Failed to create leave request:", error);
    throw new Error("ไม่สามารถส่งคำขอลาได้: " + error.message);
  }

  if (input.vacation_details && request) {
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: input.vacation_details.accumulated_days,
        annual_days: input.vacation_details.annual_days,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: input.vacation_details.branch_head_opinion,
      });

    if (vacError) {
      console.error("[leave-actions] Failed to insert vacation details:", vacError);
    }
  }

  // Notify HR/Manager about new leave request
  const { data: hrUsers } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["hr", "admin"]);
  if (hrUsers) {
    for (const hr of hrUsers) {
      await createNotificationInternal(supabase, hr.id, "new_leave_request", "มีคำขอลาใหม่รอการอนุมัติ");
    }
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
  return { success: true, id: request.id };
}

export async function createLeaveRequestByHr(
  employeeId: string,
  input: Omit<CreateLeaveRequestInput, "submission_channel">
) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: request, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: employeeId,
      leave_type_id: input.leave_type_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: input.total_days,
      reason: input.reason,
      contact_number: input.contact_number,
      medical_cert_url: input.medical_cert_url ?? null,
      expected_delivery_date: input.expected_delivery_date ?? null,
      submission_channel: "paper",
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[leave-actions] HR create leave failed:", error);
    throw new Error("ไม่สามารถส่งคำขอลาแทนพนักงานได้: " + error.message);
  }

  if (input.vacation_details && request) {
    const { error: vacError } = await supabase
      .from("leave_vacation_details")
      .insert({
        request_id: request.id,
        accumulated_days: input.vacation_details.accumulated_days,
        annual_days: input.vacation_details.annual_days,
        substitute_1_id: input.vacation_details.substitute_1_id,
        substitute_2_id: input.vacation_details.substitute_2_id,
        substitute_3_id: input.vacation_details.substitute_3_id,
        branch_head_opinion: input.vacation_details.branch_head_opinion,
      });

    if (vacError) {
      console.error("[leave-actions] HR vacation details insert failed:", vacError);
    }
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
  return { success: true, id: request.id };
}

export async function approveLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: requestData } = await supabase
    .from("leave_requests")
    .select("employee_id")
    .eq("id", requestId)
    .single();

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      approver_id: user.id,
    })
    .eq("id", requestId);

  if (error) throw new Error("ไม่สามารถอนุมัติคำขอลาได้");

  if (requestData) {
    await createNotificationInternal(supabase, requestData.employee_id, "leave_approved", "คำขอลาของคุณได้รับการอนุมัติแล้ว");
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

export async function rejectLeaveRequest(requestId: string, reason?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin" && profile.role !== "manager")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data: requestData } = await supabase
    .from("leave_requests")
    .select("employee_id")
    .eq("id", requestId)
    .single();

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: "rejected" as const,
      approver_id: user.id,
      ...(reason ? { reason } : {}),
    })
    .eq("id", requestId);

  if (error) throw new Error("ไม่สามารถปฏิเสธคำขอลาได้");

  if (requestData) {
    await createNotificationInternal(supabase, requestData.employee_id, "leave_rejected", "คำขอลาของคุณไม่ได้รับการอนุมัติ");
  }

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
  revalidatePath("/dashboard/approvals/leaves");
}

export async function cancelLeaveRequest(requestId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("employee_id", user.id)
    .eq("status", "pending");

  if (error) throw new Error("ไม่สามารถยกเลิกคำขอลาได้ (อาจถูกอนุมัติแล้ว)");

  revalidatePath("/dashboard/leaves");
  revalidatePath("/dashboard/hr/leaves");
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
