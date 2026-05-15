"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }
}

async function checkHrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) {
    throw new Error("Forbidden: HR/Admin only");
  }
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

// =============================================================================
// Leave Types (now manageable from /dashboard/hr/master-data)
// =============================================================================

export async function getLeaveTypeSettings() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("leave_types")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลประเภทลาได้");
  return data;
}

export async function createLeaveType(input: {
  name: string;
  max_days_per_year: number;
}) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const name = input.name.trim();
  if (name.length === 0 || name.length > 100) {
    throw new Error("ชื่อประเภทลาต้องมี 1-100 ตัวอักษร");
  }
  if (
    !Number.isInteger(input.max_days_per_year) ||
    input.max_days_per_year < 0 ||
    input.max_days_per_year > 365
  ) {
    throw new Error("จำนวนวันต้องเป็นจำนวนเต็ม 0-365");
  }

  const { data, error } = await supabase
    .from("leave_types")
    .insert({
      name,
      max_days_per_year: input.max_days_per_year,
      is_accumulative: false,
    })
    .select()
    .single();

  if (error) throw new Error("เพิ่มประเภทลาไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, user.id, "create_leave_type", "leave_type", data.id, {
    name,
    max_days_per_year: input.max_days_per_year,
  });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updateLeaveType(id: string, updates: { name?: string; max_days_per_year?: number }) {
  if (!UUID_RE.test(id)) throw new Error("รหัสประเภทลาไม่ถูกต้อง");

  const sanitized: { name?: string; max_days_per_year?: number } = {};

  if (updates.name !== undefined) {
    const trimmed = updates.name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      throw new Error("ชื่อประเภทลาต้องมี 1-100 ตัวอักษร");
    }
    sanitized.name = trimmed;
  }

  if (updates.max_days_per_year !== undefined) {
    if (!Number.isInteger(updates.max_days_per_year) || updates.max_days_per_year < 0 || updates.max_days_per_year > 365) {
      throw new Error("จำนวนวันต้องเป็นจำนวนเต็ม 0-365");
    }
    sanitized.max_days_per_year = updates.max_days_per_year;
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error("ไม่มีข้อมูลที่ต้องอัปเดต");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("leave_types")
    .update(sanitized)
    .eq("id", id);

  if (error) throw new Error("ไม่สามารถอัปเดตประเภทลาได้");
  await logAudit(supabase, user.id, "update_leave_type", "leave_type", id, sanitized);
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteLeaveType(id: string) {
  if (!UUID_RE.test(id)) throw new Error("รหัสประเภทลาไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  // FK protection — refuse delete if leave_requests reference this type
  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("leave_type_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ — มีคำขอลา ${count} รายการใช้ประเภทนี้`);
  }

  const { error } = await supabase.from("leave_types").delete().eq("id", id);
  if (error) throw new Error("ลบประเภทลาไม่สำเร็จ");
  await logAudit(supabase, user.id, "delete_leave_type", "leave_type", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

export async function countRequestsByLeaveType(id: string): Promise<number> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .eq("leave_type_id", id);
  return count ?? 0;
}

// =============================================================================
// Departments / System stats — relaxed RBAC where appropriate
// =============================================================================

/**
 * Public-ish list — any authenticated user may read (used by profile editor,
 * welcome form, paper-channel forms). RLS still enforces row-level rules.
 */
export async function getDepartmentList() {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลหน่วยงานได้");
  return data;
}

export async function getSystemStats() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const [profiles, leaves, travel, depts] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }),
    supabase.from("travel_requests").select("id", { count: "exact", head: true }),
    supabase.from("departments").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalUsers: profiles.count ?? 0,
    totalLeaveRequests: leaves.count ?? 0,
    totalTravelRequests: travel.count ?? 0,
    totalDepartments: depts.count ?? 0,
  };
}
