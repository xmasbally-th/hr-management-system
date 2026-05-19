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
    .select("full_name, title_th, first_name_th, last_name_th, title_en, first_name_en, last_name_en, email, phone, status, position_number, position_title, employee_type, department_id, departments(name), hire_date")
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
    status: p.status,
    positionNumber: p.position_number ?? "",
    positionTitle: p.position_title ?? "",
    department: (p.departments as { name: string } | null)?.name ?? "",
    employeeType: p.employee_type ?? "",
    hireDate: p.hire_date ?? "",
  }));
}

export async function exportLeaveRequests() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("id, start_date, end_date, total_days, status, submission_channel, created_at, leave_types(name), profiles!leave_requests_employee_id_fkey(full_name)")
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

/**
 * Export profile correction requests filtered by status + optional scope.
 * Caller passes the same filter they're viewing in the queue UI so the
 * downloaded file matches what they see on screen.
 */
export async function exportProfileCorrections(filters: {
  status?: "all" | "pending" | "resolved" | "rejected" | "cancelled";
  scope?: "all" | "first_review" | "post_approval";
} = {}) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  let query = supabase
    .from("profile_correction_requests")
    .select(
      `id, reason_text, fields_flagged, scope, status, resolver_note,
       resolved_at, created_at,
       target:profiles!profile_correction_requests_target_user_id_fkey(
         full_name, email, department:departments(name)
       ),
       resolver:profiles!profile_correction_requests_resolved_by_fkey(
         full_name
       )`,
    )
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.scope && filters.scope !== "all") {
    query = query.eq("scope", filters.scope);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[export-actions] exportProfileCorrections failed:", error);
    throw new Error("ไม่สามารถดึงข้อมูลคำขอแก้ไขได้");
  }

  type Target = { full_name?: string | null; email?: string | null; department?: { name?: string } | { name?: string }[] | null };
  type Resolver = { full_name?: string | null };

  return (data ?? []).map((r) => {
    const t = (Array.isArray(r.target) ? r.target[0] : r.target) as Target | null;
    const dept = t && (Array.isArray(t.department) ? t.department[0] : t.department);
    const resolver = (Array.isArray(r.resolver) ? r.resolver[0] : r.resolver) as
      | Resolver
      | null;
    return {
      id: r.id,
      userName: t?.full_name ?? "",
      userEmail: t?.email ?? "",
      department: dept?.name ?? "",
      scope: r.scope === "first_review" ? "ตรวจสอบครั้งแรก" : "แก้ไขเพิ่มเติม",
      status: r.status,
      fieldsFlagged: Array.isArray(r.fields_flagged)
        ? (r.fields_flagged as string[]).join("; ")
        : "",
      reason: r.reason_text ?? "",
      resolverNote: r.resolver_note ?? "",
      resolverName: resolver?.full_name ?? "",
      createdAt: r.created_at,
      resolvedAt: r.resolved_at ?? "",
    };
  });
}
