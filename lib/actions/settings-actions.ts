"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

export async function getLeaveTypeSettings() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("leave_types")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลประเภทลาได้");
  return data;
}

export async function updateLeaveType(id: string, updates: { name?: string; max_days_per_year?: number }) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("รหัสประเภทลาไม่ถูกต้อง");
  }

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
  await checkAdmin(supabase, user.id);

  const { error } = await supabase
    .from("leave_types")
    .update(sanitized)
    .eq("id", id);

  if (error) throw new Error("ไม่สามารถอัปเดตประเภทลาได้");
  revalidatePath("/dashboard/settings");
}

export async function getDepartmentList() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลแผนกได้");
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
