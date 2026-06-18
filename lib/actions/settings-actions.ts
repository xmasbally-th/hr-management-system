"use server";

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
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

export async function createLeaveType(_input: {
  name: string;
  max_days_per_year: number;
}) {
  // M2: leave types are locked to the 4 codes (SICK / PERSONAL / VACATION /
  // MATERNITY) because every business rule keys off `code`. A new type
  // would have no code and silently bypass all validation. HR may only
  // rename existing types and adjust max_days_per_year.
  throw new Error("ไม่อนุญาตให้เพิ่มประเภทลาใหม่ (ระบบล็อกไว้ 4 ประเภทตามระเบียบ)");
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

export async function deleteLeaveType(_id: string) {
  // M2: deleting one of the 4 locked types would also wipe the matching
  // leave_balances row (ON DELETE CASCADE) — refuse outright.
  throw new Error("ไม่อนุญาตให้ลบประเภทลา (ระบบล็อกไว้ 4 ประเภทตามระเบียบ)");
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
// Leave Online Submission Toggle
// =============================================================================

/**
 * Read whether online leave submission is enabled.
 * Any authenticated user can read (needed by the leave form).
 */
export async function getLeaveOnlineEnabled(): Promise<boolean> {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "leave_online_submission_enabled")
    .maybeSingle();

  if (!data) return true; // default: enabled
  const val = data.value as { enabled?: boolean } | null;
  return val?.enabled !== false;
}

/**
 * HR/Admin: update the leave online submission toggle.
 */
export async function updateLeaveOnlineEnabled(enabled: boolean): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "leave_online_submission_enabled",
        value: { enabled } as unknown as import("@/types/supabase").Database["public"]["Tables"]["system_settings"]["Insert"]["value"],
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" },
    );

  if (error) throw new Error("บันทึกค่าระบบไม่สำเร็จ");

  await logAudit(supabase, user.id, "update_leave_online_toggle", "system_setting", "leave_online_submission_enabled", {
    enabled,
  });

  revalidatePath("/dashboard/hr/master-data");
  revalidatePath("/dashboard/leaves/new");
}

// =============================================================================
// Leave policy thresholds (M5) — sick cert + personal advance notice
// =============================================================================

export interface LeavePolicy {
  sick_cert_threshold_working_days: number;
  personal_advance_notice_days: number;
}

const DEFAULT_LEAVE_POLICY: LeavePolicy = {
  sick_cert_threshold_working_days: 2,
  personal_advance_notice_days: 3,
};

/** Read leave_policy. Any authenticated user — the form needs it too. */
export async function getLeavePolicy(): Promise<LeavePolicy> {
  const supabase = await createClient();
  await getAuthUser(supabase);
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "leave_policy")
    .maybeSingle();
  const v = data?.value as Partial<LeavePolicy> | null;
  return {
    sick_cert_threshold_working_days:
      v?.sick_cert_threshold_working_days ?? DEFAULT_LEAVE_POLICY.sick_cert_threshold_working_days,
    personal_advance_notice_days:
      v?.personal_advance_notice_days ?? DEFAULT_LEAVE_POLICY.personal_advance_notice_days,
  };
}

/** HR/Admin: update leave_policy thresholds. */
export async function updateLeavePolicy(input: LeavePolicy): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const policy: LeavePolicy = {
    sick_cert_threshold_working_days: Math.max(0, Math.floor(input.sick_cert_threshold_working_days)),
    personal_advance_notice_days: Math.max(0, Math.floor(input.personal_advance_notice_days)),
  };

  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "leave_policy",
        value: policy as unknown as import("@/types/supabase").Database["public"]["Tables"]["system_settings"]["Insert"]["value"],
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" },
    );
  if (error) throw new Error("บันทึกนโยบายไม่สำเร็จ");

  await logAudit(supabase, user.id, "update_leave_policy", "system_setting", "leave_policy", { ...policy });
  revalidatePath("/dashboard/hr/master-data");
  revalidatePath("/dashboard/leaves/new");
}

// =============================================================================
// Exam-duty positions — ตำแหน่งที่มีภาระคุมสอบ (ใช้แสดงคำเตือนช่วงสอบปลายภาค)
// =============================================================================

const DEFAULT_EXAM_DUTY_POSITIONS = ["อาจารย์", "เจ้าหน้าที่"];

/**
 * Read the list of position titles that carry exam-proctoring duty.
 * Any authenticated user — the leave/travel forms need it too.
 */
export async function getExamDutyPositions(): Promise<string[]> {
  const supabase = await createClient();
  await getAuthUser(supabase);
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "exam_duty_positions")
    .maybeSingle();
  const v = data?.value as { positions?: string[] } | null;
  if (!v || !Array.isArray(v.positions)) return DEFAULT_EXAM_DUTY_POSITIONS;
  return v.positions;
}

/** HR/Admin: update the exam-duty position list. */
export async function updateExamDutyPositions(list: string[]): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  // sanitize: trim, drop blanks, dedupe, cap length/count
  const positions = Array.from(
    new Set(
      (list ?? [])
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && p.length <= 100),
    ),
  ).slice(0, 50);

  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        key: "exam_duty_positions",
        value: { positions } as unknown as import("@/types/supabase").Database["public"]["Tables"]["system_settings"]["Insert"]["value"],
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "key" },
    );
  if (error) throw new Error("บันทึกรายการตำแหน่งไม่สำเร็จ");

  await logAudit(supabase, user.id, "update_exam_duty_positions", "system_setting", "exam_duty_positions", { positions });
  revalidatePath("/dashboard/hr/master-data");
  revalidatePath("/dashboard/travel/new");
  revalidatePath("/dashboard/leaves/new");
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
