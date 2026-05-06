"use server";

import { createClient } from "@/lib/supabase/server";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function getRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("ไม่พบข้อมูลผู้ใช้");
  return data.role;
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const role = await getRole(supabase, user.id);

  const isHrOrAbove = role === "hr" || role === "admin" || role === "manager";

  const [
    profilesRes,
    pendingLeavesRes,
    pendingTravelRes,
    myLeavesRes,
    myTravelRes,
    unreadRes,
  ] = await Promise.all([
    isHrOrAbove
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved")
      : Promise.resolve({ count: 0 }),
    isHrOrAbove
      ? supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isHrOrAbove
      ? supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", user.id).eq("status", "pending"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("employee_id", user.id).eq("status", "pending"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
  ]);

  return {
    role,
    totalEmployees: profilesRes.count ?? 0,
    pendingLeaves: pendingLeavesRes.count ?? 0,
    pendingTravel: pendingTravelRes.count ?? 0,
    myPendingLeaves: myLeavesRes.count ?? 0,
    myPendingTravel: myTravelRes.count ?? 0,
    unreadNotifications: unreadRes.count ?? 0,
  };
}

export async function getLeaveBalanceSummary() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data } = await supabase
    .from("leave_balances")
    .select("leave_type_id, total_days, used_days, leave_types(name)")
    .eq("employee_id", user.id);

  return (data ?? []).map((b) => ({
    leaveType: (b.leave_types as { name: string } | null)?.name ?? "ไม่ระบุ",
    totalDays: b.total_days,
    usedDays: b.used_days,
    remainingDays: b.total_days - b.used_days,
  }));
}

export async function getReportLeaveByType() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const { data } = await supabase
    .from("leave_requests")
    .select("leave_type_id, status, leave_types(name)");

  const grouped: Record<string, { name: string; pending: number; approved: number; rejected: number }> = {};
  for (const r of data ?? []) {
    const name = (r.leave_types as { name: string } | null)?.name ?? "อื่นๆ";
    if (!grouped[r.leave_type_id]) grouped[r.leave_type_id] = { name, pending: 0, approved: 0, rejected: 0 };
    if (r.status === "pending") grouped[r.leave_type_id].pending++;
    else if (r.status === "approved") grouped[r.leave_type_id].approved++;
    else if (r.status === "rejected") grouped[r.leave_type_id].rejected++;
  }

  return Object.values(grouped);
}

export async function getReportTravelBudget() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const { data } = await supabase
    .from("travel_expenses")
    .select("expense_category, estimated_amount, actual_amount");

  const grouped: Record<string, { category: string; estimated: number; actual: number }> = {};
  for (const e of data ?? []) {
    const cat = e.expense_category;
    if (!grouped[cat]) grouped[cat] = { category: cat, estimated: 0, actual: 0 };
    grouped[cat].estimated += Number(e.estimated_amount) || 0;
    grouped[cat].actual += Number(e.actual_amount) || 0;
  }

  return Object.values(grouped);
}

export async function getReportMonthlyLeaves() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const year = new Date().getFullYear();
  const { data } = await supabase
    .from("leave_requests")
    .select("start_date, status")
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`)
    .eq("status", "approved");

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(year, i).toLocaleDateString("th-TH", { month: "short" }),
    count: 0,
  }));

  for (const r of data ?? []) {
    const m = new Date(r.start_date).getMonth();
    months[m].count++;
  }

  return months;
}

export async function getRecentActivity() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const role = await getRole(supabase, user.id);

  const isHrOrAbove = role === "hr" || role === "admin" || role === "manager";

  let leaveQuery = supabase
    .from("leave_requests")
    .select("id, status, start_date, end_date, created_at, leave_types(name), profiles!leave_requests_employee_id_fkey(first_name_th, last_name_th)")
    .order("created_at", { ascending: false })
    .limit(5);

  let travelQuery = supabase
    .from("travel_requests")
    .select("id, status, travel_type, location, created_at, profiles!travel_requests_employee_id_fkey(first_name_th, last_name_th)")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!isHrOrAbove) {
    leaveQuery = leaveQuery.eq("employee_id", user.id);
    travelQuery = travelQuery.eq("employee_id", user.id);
  }

  const [leaveRes, travelRes] = await Promise.all([leaveQuery, travelQuery]);

  const activities = [
    ...(leaveRes.data ?? []).map((r) => ({
      type: "leave" as const,
      id: r.id,
      description: `${(r.profiles as { first_name_th: string; last_name_th: string } | null)?.first_name_th ?? ""} — ${(r.leave_types as { name: string } | null)?.name ?? "ลา"}`,
      status: r.status,
      date: r.created_at,
    })),
    ...(travelRes.data ?? []).map((r) => ({
      type: "travel" as const,
      id: r.id,
      description: `${(r.profiles as { first_name_th: string; last_name_th: string } | null)?.first_name_th ?? ""} — ${r.location}`,
      status: r.status,
      date: r.created_at,
    })),
  ];

  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return activities.slice(0, 10);
}

export async function getCalendarEvents(year: number, month: number) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const endOfMonth = new Date(year, month, 0);
  const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  const [leaveRes, travelRes] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, leave_types(name), profiles!leave_requests_employee_id_fkey(first_name_th, last_name_th)")
      .or(`and(start_date.lte.${endStr},end_date.gte.${startOfMonth})`)
      .in("status", ["pending", "approved"]),
    supabase
      .from("travel_requests")
      .select("id, start_date, end_date, status, travel_type, location, profiles!travel_requests_employee_id_fkey(first_name_th, last_name_th)")
      .or(`and(start_date.lte.${endStr},end_date.gte.${startOfMonth})`)
      .in("status", ["pending", "approved"]),
  ]);

  const events: {
    id: string;
    type: "leave" | "travel";
    label: string;
    person: string;
    status: string;
    startDate: string;
    endDate: string;
  }[] = [];

  for (const r of leaveRes.data ?? []) {
    const p = r.profiles as { first_name_th: string; last_name_th: string } | null;
    events.push({
      id: r.id,
      type: "leave",
      label: (r.leave_types as { name: string } | null)?.name ?? "ลา",
      person: p ? `${p.first_name_th} ${p.last_name_th}` : "",
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
    });
  }

  for (const r of travelRes.data ?? []) {
    const p = r.profiles as { first_name_th: string; last_name_th: string } | null;
    events.push({
      id: r.id,
      type: "travel",
      label: r.location,
      person: p ? `${p.first_name_th} ${p.last_name_th}` : "",
      status: r.status,
      startDate: r.start_date,
      endDate: r.end_date,
    });
  }

  return events;
}

async function checkManagerOrAbove(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error) throw new Error("ไม่สามารถตรวจสอบสิทธิ์ได้");
  if (!profile || !["manager", "hr", "admin"].includes(profile.role)) {
    throw new Error("Forbidden");
  }
}
