"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Lightweight fetch of recent pending profile-correction requests for
 * the HR/Admin dashboard panels. Returns 5 most-recent + total count.
 * No role check here — caller (getHrDashboardData / getAdminDashboardData)
 * has already verified the user is hr/admin.
 */
async function fetchPendingCorrectionsForPanel(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{
  total: number;
  recent: Array<{
    id: string;
    target_user_id: string;
    user_name: string | null;
    department: string | null;
    reason_excerpt: string;
    fields_count: number;
    created_at: string;
  }>;
}> {
  const [{ count }, { data }] = await Promise.all([
    supabase
      .from("profile_correction_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profile_correction_requests")
      .select(
        `id, target_user_id, reason_text, fields_flagged, created_at,
         target:profiles!profile_correction_requests_target_user_id_fkey(
           full_name, department:departments(name)
         )`,
      )
      .eq("status", "pending")
      // Oldest-first so the dashboard panel surfaces the most stale
      // requests at the top — matches the queue's pending-mode sort.
      .order("created_at", { ascending: true })
      .limit(5),
  ]);

  const recent = (data ?? []).map((r) => {
    const t = Array.isArray(r.target) ? r.target[0] : r.target;
    const dept = t && (Array.isArray(t.department) ? t.department[0] : t.department);
    const reasonText = (r.reason_text ?? "").trim();
    return {
      id: r.id,
      target_user_id: r.target_user_id,
      user_name: t?.full_name ?? null,
      department: dept?.name ?? null,
      reason_excerpt:
        reasonText.length > 80 ? reasonText.slice(0, 80) + "…" : reasonText,
      fields_count: Array.isArray(r.fields_flagged) ? r.fields_flagged.length : 0,
      created_at: r.created_at,
    };
  });

  return { total: count ?? 0, recent };
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

/** Optional inclusive date filter for the report actions. */
export interface ReportRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export async function getReportLeaveByType(range?: ReportRange) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  let q = supabase
    .from("leave_requests")
    .select("leave_type_id, status, leave_types(name)");
  if (range) {
    q = q.gte("start_date", range.start).lte("start_date", range.end);
  }
  const { data } = await q;

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

export async function getReportTravelBudget(range?: ReportRange) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  if (range) {
    // travel_expenses doesn't have a date column — filter via the parent
    // travel_request's start_date by joining.
    const { data } = await supabase
      .from("travel_expenses")
      .select(
        "expense_category, estimated_amount, actual_amount, travel_request:travel_requests!inner(start_date)",
      )
      .gte("travel_request.start_date", range.start)
      .lte("travel_request.start_date", range.end);

    const grouped: Record<string, { category: string; estimated: number; actual: number }> = {};
    for (const e of data ?? []) {
      const cat = e.expense_category;
      if (!grouped[cat]) grouped[cat] = { category: cat, estimated: 0, actual: 0 };
      grouped[cat].estimated += Number(e.estimated_amount) || 0;
      grouped[cat].actual += Number(e.actual_amount) || 0;
    }
    return Object.values(grouped);
  }

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

const THAI_MONTH_ABBR = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * Returns one bucket per month between range.start and range.end (inclusive).
 * Bucket label is "เดือน 2568" (Thai short month + พ.ศ. year). Without a
 * range, defaults to the current calendar year (12 buckets, Jan-Dec).
 */
export async function getReportMonthlyLeaves(range?: ReportRange) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const start = range ? new Date(range.start) : new Date(`${new Date().getFullYear()}-01-01`);
  const end = range ? new Date(range.end) : new Date(`${new Date().getFullYear()}-12-31`);

  // Build month buckets between start and end
  const buckets: Array<{ key: string; label: string; count: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endCursor) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    buckets.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${THAI_MONTH_ABBR[m]} ${(y + 543).toString().slice(-2)}`,
      count: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const { data } = await supabase
    .from("leave_requests")
    .select("start_date, status")
    .gte("start_date", buckets[0]?.key ? `${buckets[0].key}-01` : `${start.getFullYear()}-01-01`)
    .lte(
      "start_date",
      buckets.length > 0
        ? // Approximate end-of-last-month — over-fetches a few days but the
          // bucket lookup below ignores rows outside the range.
          `${buckets[buckets.length - 1].key}-31`
        : `${end.getFullYear()}-12-31`,
    )
    .eq("status", "approved");

  const indexByKey = new Map<string, number>();
  buckets.forEach((b, i) => indexByKey.set(b.key, i));

  for (const r of data ?? []) {
    const d = new Date(r.start_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx !== undefined) buckets[idx].count++;
  }

  return buckets.map((b) => ({ month: b.label, count: b.count }));
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

/* ============================================================================
 * Role-specific dashboard data (HR Dashboard v2)
 * ============================================================================ */

export interface ManagerDashboardData {
  pendingLeavesCount: number;
  pendingTravelCount: number;
  teamCount: number;
  leavesToday: number;
  travelToday: number;
  approvalsThisMonth: number;
  queue: Array<{
    id: string;
    type: "leave" | "travel";
    name: string;
    initials: string;
    detail: string;
    waitingHours: number;
    urgent: boolean;
  }>;
  todayLeaves: Array<{ name: string; initials: string; leaveType: string }>;
}

export async function getManagerDashboardData(): Promise<ManagerDashboardData> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 7)}-01`;

  const [
    pendingLeavesRes,
    pendingTravelRes,
    teamRes,
    leavesTodayRes,
    travelTodayRes,
    monthApprovedLeavesRes,
    monthApprovedTravelRes,
    queueLeavesRes,
    queueTravelRes,
    todayLeavesListRes,
  ] = await Promise.all([
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("status", "approved"),
    supabase
      .from("travel_requests")
      .select("id", { count: "exact", head: true })
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("status", "approved"),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("updated_at", startOfMonth),
    supabase
      .from("travel_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("updated_at", startOfMonth),
    supabase
      .from("leave_requests")
      .select("id, total_days, created_at, leave_types(name), profiles!leave_requests_employee_id_fkey(first_name_th, last_name_th)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("travel_requests")
      .select("id, total_days, location, travel_type, created_at, profiles!travel_requests_employee_id_fkey(first_name_th, last_name_th), expenses:travel_expenses(estimated_amount)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("leave_requests")
      .select("id, leave_types(name), profiles!leave_requests_employee_id_fkey(first_name_th, last_name_th)")
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("status", "approved")
      .limit(8),
  ]);

  const now = Date.now();
  const initialsOf = (first?: string, last?: string) => {
    const f = (first || "").trim();
    const l = (last || "").trim();
    if (!f && !l) return "?";
    return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase();
  };

  const queueLeaves = (queueLeavesRes.data ?? []).map((r) => {
    const p = r.profiles as { first_name_th: string; last_name_th: string } | null;
    const lt = r.leave_types as { name: string } | null;
    const hours = (now - new Date(r.created_at).getTime()) / 36e5;
    return {
      id: r.id,
      type: "leave" as const,
      name: p ? `${p.first_name_th} ${p.last_name_th}` : "ไม่ทราบชื่อ",
      initials: initialsOf(p?.first_name_th, p?.last_name_th),
      detail: `${lt?.name ?? "ลา"} · ${r.total_days} วัน`,
      waitingHours: hours,
      urgent: hours > 48,
    };
  });

  const queueTravel = (queueTravelRes.data ?? []).map((r) => {
    const p = r.profiles as { first_name_th: string; last_name_th: string } | null;
    const exps = (r.expenses ?? []) as Array<{ estimated_amount: number }>;
    const budget = exps.reduce((s, e) => s + Number(e.estimated_amount ?? 0), 0);
    const hours = (now - new Date(r.created_at).getTime()) / 36e5;
    return {
      id: r.id,
      type: "travel" as const,
      name: p ? `${p.first_name_th} ${p.last_name_th}` : "ไม่ทราบชื่อ",
      initials: initialsOf(p?.first_name_th, p?.last_name_th),
      detail: `${r.location} · ${r.total_days} วัน · ฿${budget.toLocaleString()}`,
      waitingHours: hours,
      urgent: hours > 48,
    };
  });

  const queue = [...queueLeaves, ...queueTravel]
    .sort((a, b) => b.waitingHours - a.waitingHours)
    .slice(0, 6);

  const todayLeaves = (todayLeavesListRes.data ?? []).map((r) => {
    const p = r.profiles as { first_name_th: string; last_name_th: string } | null;
    const lt = r.leave_types as { name: string } | null;
    return {
      name: p ? `${p.first_name_th} ${p.last_name_th}` : "—",
      initials: initialsOf(p?.first_name_th, p?.last_name_th),
      leaveType: lt?.name ?? "ลา",
    };
  });

  return {
    pendingLeavesCount: pendingLeavesRes.count ?? 0,
    pendingTravelCount: pendingTravelRes.count ?? 0,
    teamCount: teamRes.count ?? 0,
    leavesToday: leavesTodayRes.count ?? 0,
    travelToday: travelTodayRes.count ?? 0,
    approvalsThisMonth: (monthApprovedLeavesRes.count ?? 0) + (monthApprovedTravelRes.count ?? 0),
    queue,
    todayLeaves,
  };
}

export interface HrDashboardData {
  totalEmployees: number;
  pendingLeavesCount: number;
  pendingTravelCount: number;
  approvedToday: number;
  paperPending: number;
  scannedPending: number;
  pipeline: { pending: number; approved: number; completed: number; rejected: number };
  recentDocs: Array<{
    id: string;
    type: "leave" | "travel";
    name: string;
    initials: string;
    dept: string;
    status: string;
    channel: string | null;
    createdAt: string;
  }>;
  departments: Array<{ name: string; total: number }>;
  pendingCorrections: {
    total: number;
    recent: Array<{
      id: string;
      target_user_id: string;
      user_name: string | null;
      department: string | null;
      reason_excerpt: string;
      fields_count: number;
      created_at: string;
    }>;
  };
}

export async function getHrDashboardData(): Promise<HrDashboardData> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkManagerOrAbove(supabase, user.id);

  const today = new Date().toISOString().slice(0, 10);

  const [
    totalEmpRes,
    pendingLeavesRes,
    pendingTravelRes,
    approvedTodayLeavesRes,
    approvedTodayTravelRes,
    paperPendingRes,
    scannedPendingRes,
    leavePipelineRes,
    travelPipelineRes,
    recentLeavesRes,
    recentTravelRes,
    departmentsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("updated_at", `${today}T00:00:00`),
    supabase
      .from("travel_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("updated_at", `${today}T00:00:00`),
    supabase
      .from("travel_requests")
      .select("id", { count: "exact", head: true })
      .eq("submission_channel", "paper")
      .in("status", ["pending", "approved"]),
    supabase
      .from("travel_requests")
      .select("id", { count: "exact", head: true })
      .eq("submission_channel", "paper")
      .eq("status", "approved")
      .is("order_document_url", null),
    supabase.from("leave_requests").select("status"),
    supabase.from("travel_requests").select("status"),
    supabase
      .from("leave_requests")
      .select("id, status, submission_channel, created_at, profiles!leave_requests_employee_id_fkey(first_name_th, last_name_th, departments(name))")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("travel_requests")
      .select("id, status, submission_channel, created_at, profiles!travel_requests_employee_id_fkey(first_name_th, last_name_th, departments(name))")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("departments").select("id, name, profiles(id)"),
  ]);

  const initialsOf = (first?: string, last?: string) => {
    const f = (first || "").trim();
    const l = (last || "").trim();
    if (!f && !l) return "?";
    return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase();
  };

  const pipeline = { pending: 0, approved: 0, completed: 0, rejected: 0 };
  for (const r of leavePipelineRes.data ?? []) {
    if (r.status in pipeline) (pipeline as Record<string, number>)[r.status]++;
  }
  for (const r of travelPipelineRes.data ?? []) {
    if (r.status in pipeline) (pipeline as Record<string, number>)[r.status]++;
  }

  type ProfileWithDept = {
    first_name_th: string;
    last_name_th: string;
    departments: { name: string } | null;
  } | null;

  const recentLeaves = (recentLeavesRes.data ?? []).map((r) => {
    const p = r.profiles as ProfileWithDept;
    return {
      id: r.id,
      type: "leave" as const,
      name: p ? `${p.first_name_th} ${p.last_name_th}` : "—",
      initials: initialsOf(p?.first_name_th, p?.last_name_th),
      dept: p?.departments?.name ?? "—",
      status: r.status,
      channel: r.submission_channel,
      createdAt: r.created_at,
    };
  });

  const recentTravel = (recentTravelRes.data ?? []).map((r) => {
    const p = r.profiles as ProfileWithDept;
    return {
      id: r.id,
      type: "travel" as const,
      name: p ? `${p.first_name_th} ${p.last_name_th}` : "—",
      initials: initialsOf(p?.first_name_th, p?.last_name_th),
      dept: p?.departments?.name ?? "—",
      status: r.status,
      channel: r.submission_channel,
      createdAt: r.created_at,
    };
  });

  const recentDocs = [...recentLeaves, ...recentTravel]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const departments = (departmentsRes.data ?? []).map((d) => ({
    name: d.name as string,
    total: ((d as { profiles?: unknown[] }).profiles ?? []).length,
  }));

  const pendingCorrections = await fetchPendingCorrectionsForPanel(supabase).catch(
    () => ({ total: 0, recent: [] }),
  );

  return {
    totalEmployees: totalEmpRes.count ?? 0,
    pendingLeavesCount: pendingLeavesRes.count ?? 0,
    pendingTravelCount: pendingTravelRes.count ?? 0,
    approvedToday: (approvedTodayLeavesRes.count ?? 0) + (approvedTodayTravelRes.count ?? 0),
    paperPending: paperPendingRes.count ?? 0,
    scannedPending: scannedPendingRes.count ?? 0,
    pipeline,
    recentDocs,
    departments,
    pendingCorrections,
  };
}

export interface AdminDashboardData {
  totalUsers: number;
  rolesDistribution: Array<{ role: string; count: number }>;
  recentAuditLogs: Array<{
    id: string;
    timestamp: string;
    user: string;
    initials: string;
    action: string;
    target: string;
  }>;
  alertsCount: number;
  apiCalls24h: number;
  pendingCorrections: HrDashboardData["pendingCorrections"];
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error || !profile || profile.role !== "admin") throw new Error("Forbidden");
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [usersRes, rolesRes, auditRes, apiCallsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("role"),
    supabase
      .from("audit_logs")
      .select("id, action, target_type, target_id, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
  ]);

  const roleCounts: Record<string, number> = { employee: 0, manager: 0, hr: 0, admin: 0 };
  for (const r of rolesRes.data ?? []) {
    if (r.role in roleCounts) roleCounts[r.role]++;
  }

  const initialsOf = (first?: string, last?: string) => {
    const f = (first || "").trim();
    const l = (last || "").trim();
    if (!f && !l) return "?";
    return ((f[0] ?? "") + (l[0] ?? "")).toUpperCase();
  };

  // Fetch user names for audit log entries (separate query — audit_logs has no FK relation)
  const userIds = Array.from(new Set((auditRes.data ?? []).map((a) => a.user_id)));
  const namesByUserId: Record<string, { first: string; last: string }> = {};
  if (userIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name_th, last_name_th")
      .in("id", userIds);
    for (const p of profilesData ?? []) {
      namesByUserId[p.id] = {
        first: p.first_name_th ?? "",
        last: p.last_name_th ?? "",
      };
    }
  }

  const recentAuditLogs = (auditRes.data ?? []).map((a) => {
    const name = namesByUserId[a.user_id];
    return {
      id: a.id,
      timestamp: a.created_at,
      user: name ? `${name.first} ${name.last}`.trim() || "system" : "system",
      initials: name ? initialsOf(name.first, name.last) : "S",
      action: a.action,
      target: `${a.target_type}#${a.target_id.slice(0, 8)}`,
    };
  });

  const pendingCorrections = await fetchPendingCorrectionsForPanel(supabase).catch(
    () => ({ total: 0, recent: [] }),
  );

  return {
    totalUsers: usersRes.count ?? 0,
    rolesDistribution: Object.entries(roleCounts).map(([role, count]) => ({ role, count })),
    recentAuditLogs,
    alertsCount: 0,
    apiCalls24h: apiCallsRes.count ?? 0,
    pendingCorrections,
  };
}
