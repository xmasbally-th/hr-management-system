"use server";

import { createClient } from "@/lib/supabase/server";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function checkHrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden");
  }
}

export async function exportEmployees() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, title_th, first_name_th, last_name_th, title_en, first_name_en, last_name_en, email, phone, role, status, position_number, position_title, employee_type, department_id, departments(name), hire_date, created_at")
    .order("full_name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลพนักงานได้");

  return (data ?? []).map((p) => ({
    fullName: p.full_name ?? "",
    titleTh: p.title_th ?? "",
    firstNameTh: p.first_name_th ?? "",
    lastNameTh: p.last_name_th ?? "",
    titleEn: p.title_en ?? "",
    firstNameEn: p.first_name_en ?? "",
    lastNameEn: p.last_name_en ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    role: p.role,
    status: p.status,
    positionNumber: p.position_number ?? "",
    positionTitle: p.position_title ?? "",
    department: (p.departments as { name: string } | null)?.name ?? "",
    employeeType: p.employee_type ?? "",
    hireDate: p.hire_date ?? "",
    createdAt: p.created_at,
  }));
}

export async function exportLeaveRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, total_days, reason, status, submission_channel, created_at, leave_types(name), profiles!leave_requests_employee_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการลาได้");

  return (data ?? []).map((r) => {
    const p = r.profiles as { full_name: string } | null;
    return {
      name: p?.full_name ?? "",
      leaveType: (r.leave_types as { name: string } | null)?.name ?? "",
      startDate: r.start_date,
      endDate: r.end_date,
      totalDays: r.total_days,
      reason: r.reason ?? "",
      status: r.status,
      channel: r.submission_channel ?? "online",
      createdAt: r.created_at,
    };
  });
}

export async function exportTravelRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("travel_requests")
    .select("id, travel_type, title, location, start_date, end_date, total_days, status, submission_channel, created_at, profiles!travel_requests_employee_id_fkey(full_name), travel_expenses(expense_category, estimated_amount, actual_amount)")
    .order("created_at", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลเดินทางได้");

  return (data ?? []).map((r) => {
    const p = r.profiles as { full_name: string } | null;
    const expenses = (r.travel_expenses ?? []) as { expense_category: string; estimated_amount: number; actual_amount: number | null }[];
    const totalEstimated = expenses.reduce((sum, e) => sum + (Number(e.estimated_amount) || 0), 0);
    const totalActual = expenses.reduce((sum, e) => sum + (Number(e.actual_amount) || 0), 0);
    return {
      name: p?.full_name ?? "",
      travelType: r.travel_type,
      title: r.title,
      location: r.location,
      startDate: r.start_date,
      endDate: r.end_date,
      totalDays: r.total_days,
      estimatedBudget: totalEstimated,
      actualBudget: totalActual,
      status: r.status,
      channel: r.submission_channel ?? "online",
      createdAt: r.created_at,
    };
  });
}
