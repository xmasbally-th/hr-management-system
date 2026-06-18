"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { revalidatePath } from "next/cache";
import { UUID_RE, validateRequestDates, validateEmployeeExists, validateTextField } from "./validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

/* ── Helpers ──────────────────────────────────────────────────────────── */

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
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

/* ── Types ────────────────────────────────────────────────────────────── */

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 10;


/* ── Read: Employee's own trainings ──────────────────────────────────── */

export async function getMyTrainings(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("employee_trainings")
    .select("*", { count: "exact" })
    .eq("employee_id", user.id);

  if (params?.search) {
    query = query.or(`course_name.ilike.%${params.search}%,location.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("start_date", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการอบรมได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

/* ── Read: All trainings (HR/Admin/Manager) ──────────────────────────── */

export async function getAllTrainings(params?: PaginationParams & { employeeId?: string }): Promise<PaginatedResult<Record<string, unknown>>> {
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
    .from("employee_trainings")
    .select(`
      *,
      employee:profiles!employee_trainings_employee_id_fkey(full_name, email)
    `, { count: "exact" });

  if (params?.employeeId) {
    query = query.eq("employee_id", params.employeeId);
  }

  if (params?.search) {
    query = query.or(`course_name.ilike.%${params.search}%,location.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("start_date", { ascending: false })
    .range(from, to);

  if (error) throw new Error("ไม่สามารถดึงข้อมูลการอบรมทั้งหมดได้");
  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

/* ── Create (HR/Admin only) ──────────────────────────────────────────── */

export interface CreateTrainingInput {
  employee_id: string;
  course_name: string;
  training_type: string;
  location?: string | null;
  start_date: string;
  end_date: string;
  total_hours?: number | null;
  total_cost?: number | null;
}

export async function createTraining(input: CreateTrainingInput) {
  if (!UUID_RE.test(input.employee_id)) {
    throw new Error("รหัสพนักงานไม่ถูกต้อง");
  }

  const courseName = validateTextField(input.course_name, "ชื่อหลักสูตร", 300);
  if (!courseName) throw new Error("กรุณาระบุชื่อหลักสูตร");

  validateRequestDates(input.start_date, input.end_date, 1);

  const location = validateTextField(input.location ?? null, "สถานที่", 300);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  await validateEmployeeExists(supabase, input.employee_id);

  const { data, error } = await supabase
    .from("employee_trainings")
    .insert({
      employee_id: input.employee_id,
      course_name: courseName,
      training_type: input.training_type,
      location: location || null,
      start_date: input.start_date,
      end_date: input.end_date,
      total_hours: input.total_hours ?? null,
      total_cost: input.total_cost ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[training-actions] Failed to create training:", error);
    throw new Error("ไม่สามารถบันทึกข้อมูลการอบรมได้");
  }

  await logAudit(supabase, user.id, "create_training", "employee_training", data.id, {
    employee_id: input.employee_id,
    course_name: courseName,
  });

  revalidatePath("/dashboard/trainings");
  revalidatePath("/dashboard/hr/trainings");
  return { success: true, id: data.id };
}

/* ── Update (HR/Admin only) ──────────────────────────────────────────── */

export async function updateTraining(trainingId: string, input: Partial<Omit<CreateTrainingInput, "employee_id">>) {
  if (!UUID_RE.test(trainingId)) throw new Error("รหัสการอบรมไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const updateData: Record<string, unknown> = {};

  if (input.course_name !== undefined) {
    const name = validateTextField(input.course_name, "ชื่อหลักสูตร", 300);
    if (!name) throw new Error("กรุณาระบุชื่อหลักสูตร");
    updateData.course_name = name;
  }
  if (input.training_type !== undefined) updateData.training_type = input.training_type;
  if (input.location !== undefined) updateData.location = validateTextField(input.location ?? null, "สถานที่", 300) || null;
  if (input.start_date !== undefined) updateData.start_date = input.start_date;
  if (input.end_date !== undefined) updateData.end_date = input.end_date;
  if (input.total_hours !== undefined) updateData.total_hours = input.total_hours;
  if (input.total_cost !== undefined) updateData.total_cost = input.total_cost;

  const { error } = await supabase
    .from("employee_trainings")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updateData as any)
    .eq("id", trainingId);

  if (error) {
    console.error("[training-actions] Failed to update training:", error);
    throw new Error("ไม่สามารถแก้ไขข้อมูลการอบรมได้");
  }

  await logAudit(supabase, user.id, "update_training", "employee_training", trainingId);

  revalidatePath("/dashboard/trainings");
  revalidatePath("/dashboard/hr/trainings");
}

/* ── Delete (HR/Admin only) ──────────────────────────────────────────── */

export async function deleteTraining(trainingId: string) {
  if (!UUID_RE.test(trainingId)) throw new Error("รหัสการอบรมไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  const profile = await getProfile(supabase, user.id);

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { error } = await supabase
    .from("employee_trainings")
    .delete()
    .eq("id", trainingId);

  if (error) {
    console.error("[training-actions] Failed to delete training:", error);
    throw new Error("ไม่สามารถลบข้อมูลการอบรมได้");
  }

  await logAudit(supabase, user.id, "delete_training", "employee_training", trainingId);

  revalidatePath("/dashboard/trainings");
  revalidatePath("/dashboard/hr/trainings");
}
