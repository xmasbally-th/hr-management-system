"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { createNotificationInternal } from "./notification-actions";
import { ISO_DATE_RE } from "@/lib/actions/validators";
import type {
  UpdateMyProfileInput,
  EducationInput,
  DecorationInput,
  AdminPositionInput,
} from "@/lib/actions/profile-actions";

/**
 * HR/Admin-only profile mutations for editing other users' profiles.
 *
 * These parallel `profile-actions.ts` (self-actions) but accept a
 * `targetUserId` and require the caller to have hr/admin role.
 *
 * Each mutation:
 *   1. Verifies caller has hr/admin role
 *   2. Verifies target user exists
 *   3. Applies the mutation (bypassing the target_user_id = auth.uid()
 *      filter that self-actions use)
 *   4. Logs audit with both actor and target IDs
 *   5. Notifies the target user that an HR edit happened
 */

async function checkHrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR or admin role required");
  }
  return user.id;
}

async function assertTargetExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string,
): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!data) throw new Error("ไม่พบผู้ใช้เป้าหมาย");
}

function trim(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function validateOptionalDate(v: string | null, label: string): void {
  if (v && !ISO_DATE_RE.test(v)) {
    throw new Error(`${label}ไม่ถูกต้อง (รูปแบบ YYYY-MM-DD)`);
  }
}

async function notifyTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  targetUserId: string,
  message: string,
): Promise<void> {
  try {
    await createNotificationInternal(
      supabase,
      targetUserId,
      "profile_edited_by_hr",
      message,
    );
  } catch {
    // Fire-and-forget — don't block the edit if notification fails.
  }
}

// =============================================================================
// profiles.* — identity + position
// =============================================================================

export async function updateProfileAsHr(
  targetUserId: string,
  input: UpdateMyProfileInput,
): Promise<void> {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  await assertTargetExists(supabase, targetUserId);

  validateOptionalDate(trim(input.birth_date), "วันเดือนปีเกิด");
  validateOptionalDate(trim(input.hire_date), "วันที่เริ่มทำงาน");

  const titleTh = trim(input.title_th);
  const firstTh = trim(input.first_name_th);
  const lastTh = trim(input.last_name_th);
  const fullName =
    titleTh || firstTh || lastTh
      ? [titleTh, firstTh, lastTh].filter(Boolean).join(" ").replace(/\s+/g, " ")
      : null;

  // Coerce empty string → null for FK and trimmed optional fields, so
  // an unfilled dropdown doesn't violate the departments FK constraint.
  const deptId = trim(input.department_id);

  const patch = {
    title_th: titleTh,
    first_name_th: firstTh,
    last_name_th: lastTh,
    title_en: trim(input.title_en),
    first_name_en: trim(input.first_name_en),
    last_name_en: trim(input.last_name_en),
    phone: trim(input.phone),
    position_title: trim(input.position_title),
    position_number: trim(input.position_number),
    employee_type: trim(input.employee_type),
    department_id: deptId,
    gender: trim(input.gender),
    birth_date: trim(input.birth_date),
    hire_date: trim(input.hire_date),
    education_level: trim(input.education_level),
    current_address: trim(input.current_address),
    updated_at: new Date().toISOString(),
    ...(fullName ? { full_name: fullName } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", targetUserId);

  if (error) {
    console.error("[hr-profile-actions] updateProfileAsHr failed:", error);
    throw new Error("บันทึกข้อมูลไม่สำเร็จ: " + error.message);
  }

  await logAudit(
    supabase,
    actorId,
    "hr_update_profile",
    "profile",
    targetUserId,
    {},
  );
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลได้แก้ไขข้อมูลโปรไฟล์ของคุณ");

  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
  revalidatePath("/dashboard/hr/users");
}

// =============================================================================
// profile_educations
// =============================================================================

function validateEducation(e: EducationInput) {
  if (!e.institution?.trim()) throw new Error("กรุณาระบุสถานศึกษา");
  if (!e.degree?.trim()) throw new Error("กรุณาระบุวุฒิการศึกษา");
  if (e.entry_year !== null && e.entry_year !== undefined) {
    if (!Number.isInteger(e.entry_year) || e.entry_year < 1900 || e.entry_year > 2999) {
      throw new Error("ปีที่เข้าศึกษาไม่ถูกต้อง");
    }
  }
  if (e.graduation_year !== null && e.graduation_year !== undefined) {
    if (!Number.isInteger(e.graduation_year) || e.graduation_year < 1900 || e.graduation_year > 2999) {
      throw new Error("ปีที่จบการศึกษาไม่ถูกต้อง");
    }
  }
}

export async function addEducationAsHr(
  targetUserId: string,
  input: EducationInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  await assertTargetExists(supabase, targetUserId);
  validateEducation(input);

  const { data, error } = await supabase
    .from("profile_educations")
    .insert({
      profile_id: targetUserId,
      entry_year: input.entry_year ?? null,
      graduation_year: input.graduation_year ?? null,
      institution: input.institution.trim(),
      country: trim(input.country),
      degree: input.degree.trim(),
      program_name: trim(input.program_name),
      major_field: trim(input.major_field),
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มประวัติการศึกษาไม่สำเร็จ: " + error.message);

  await logAudit(supabase, actorId, "hr_add_education", "profile_educations", data.id, {
    target: targetUserId,
  });
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลเพิ่มประวัติการศึกษาให้คุณ");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
  return data;
}

export async function updateEducationAsHr(
  targetUserId: string,
  id: string,
  input: EducationInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  validateEducation(input);

  const { error } = await supabase
    .from("profile_educations")
    .update({
      entry_year: input.entry_year ?? null,
      graduation_year: input.graduation_year ?? null,
      institution: input.institution.trim(),
      country: trim(input.country),
      degree: input.degree.trim(),
      program_name: trim(input.program_name),
      major_field: trim(input.major_field),
    })
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("แก้ไขประวัติการศึกษาไม่สำเร็จ");

  await logAudit(supabase, actorId, "hr_update_education", "profile_educations", id, {
    target: targetUserId,
  });
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลแก้ไขประวัติการศึกษาของคุณ");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

export async function deleteEducationAsHr(targetUserId: string, id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profile_educations")
    .delete()
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("ลบประวัติการศึกษาไม่สำเร็จ");

  await logAudit(supabase, actorId, "hr_delete_education", "profile_educations", id, {
    target: targetUserId,
  });
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

// =============================================================================
// profile_decorations
// =============================================================================

function validateDecoration(d: DecorationInput) {
  if (!d.decoration_name?.trim()) throw new Error("กรุณาระบุชื่อเครื่องราชอิสริยาภรณ์");
  validateOptionalDate(trim(d.approved_date), "วันที่อนุมัติ");
}

export async function addDecorationAsHr(
  targetUserId: string,
  input: DecorationInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  await assertTargetExists(supabase, targetUserId);
  validateDecoration(input);

  const { data, error } = await supabase
    .from("profile_decorations")
    .insert({
      profile_id: targetUserId,
      decoration_name: input.decoration_name.trim(),
      abbreviation: trim(input.abbreviation),
      document_reference: trim(input.document_reference),
      approved_date: trim(input.approved_date),
      position_at_grant: trim(input.position_at_grant),
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มเครื่องราชอิสริยาภรณ์ไม่สำเร็จ: " + error.message);

  await logAudit(supabase, actorId, "hr_add_decoration", "profile_decorations", data.id, {
    target: targetUserId,
  });
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลเพิ่มเครื่องราชอิสริยาภรณ์");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
  return data;
}

export async function updateDecorationAsHr(
  targetUserId: string,
  id: string,
  input: DecorationInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  validateDecoration(input);

  const { error } = await supabase
    .from("profile_decorations")
    .update({
      decoration_name: input.decoration_name.trim(),
      abbreviation: trim(input.abbreviation),
      document_reference: trim(input.document_reference),
      approved_date: trim(input.approved_date),
      position_at_grant: trim(input.position_at_grant),
    })
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("แก้ไขเครื่องราชอิสริยาภรณ์ไม่สำเร็จ");

  await logAudit(supabase, actorId, "hr_update_decoration", "profile_decorations", id, {
    target: targetUserId,
  });
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลแก้ไขข้อมูลเครื่องราชอิสริยาภรณ์");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

export async function deleteDecorationAsHr(targetUserId: string, id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profile_decorations")
    .delete()
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("ลบเครื่องราชอิสริยาภรณ์ไม่สำเร็จ");

  await logAudit(supabase, actorId, "hr_delete_decoration", "profile_decorations", id, {
    target: targetUserId,
  });
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

// =============================================================================
// profile_admin_positions
// =============================================================================

function validateAdminPosition(p: AdminPositionInput) {
  if (!p.position_title?.trim()) throw new Error("กรุณาระบุตำแหน่ง");
  if (!p.start_date?.trim()) throw new Error("กรุณาระบุวันเริ่มปฏิบัติงาน");
  if (!ISO_DATE_RE.test(p.start_date)) throw new Error("วันเริ่มปฏิบัติงานไม่ถูกต้อง");
  if (p.end_date) {
    if (!ISO_DATE_RE.test(p.end_date)) throw new Error("วันสิ้นสุดไม่ถูกต้อง");
    if (p.end_date < p.start_date) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  }
}

export async function addAdminPositionAsHr(
  targetUserId: string,
  input: AdminPositionInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  await assertTargetExists(supabase, targetUserId);
  validateAdminPosition(input);

  const { data, error } = await supabase
    .from("profile_admin_positions")
    .insert({
      profile_id: targetUserId,
      appointment_order_number: trim(input.appointment_order_number),
      position_title: input.position_title.trim(),
      responsible_unit: trim(input.responsible_unit),
      start_date: input.start_date,
      end_date: trim(input.end_date),
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มประวัติการบริหารไม่สำเร็จ: " + error.message);

  await logAudit(
    supabase,
    actorId,
    "hr_add_admin_position",
    "profile_admin_positions",
    data.id,
    { target: targetUserId },
  );
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลเพิ่มประวัติการดำรงตำแหน่งบริหาร");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
  return data;
}

export async function updateAdminPositionAsHr(
  targetUserId: string,
  id: string,
  input: AdminPositionInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);
  validateAdminPosition(input);

  const { error } = await supabase
    .from("profile_admin_positions")
    .update({
      appointment_order_number: trim(input.appointment_order_number),
      position_title: input.position_title.trim(),
      responsible_unit: trim(input.responsible_unit),
      start_date: input.start_date,
      end_date: trim(input.end_date),
    })
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("แก้ไขประวัติการบริหารไม่สำเร็จ");

  await logAudit(
    supabase,
    actorId,
    "hr_update_admin_position",
    "profile_admin_positions",
    id,
    { target: targetUserId },
  );
  await notifyTarget(supabase, targetUserId, "ฝ่ายบุคคลแก้ไขประวัติการดำรงตำแหน่งบริหาร");
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

export async function deleteAdminPositionAsHr(targetUserId: string, id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profile_admin_positions")
    .delete()
    .eq("id", id)
    .eq("profile_id", targetUserId);
  if (error) throw new Error("ลบประวัติการบริหารไม่สำเร็จ");

  await logAudit(
    supabase,
    actorId,
    "hr_delete_admin_position",
    "profile_admin_positions",
    id,
    { target: targetUserId },
  );
  revalidatePath(`/dashboard/hr/users/${targetUserId}/edit`);
}

// =============================================================================
// Fetch — get target user's profile + history (HR view)
// =============================================================================

export async function getUserProfileWithHistory(targetUserId: string) {
  const supabase = await createClient();
  await checkHrAdmin(supabase);

  const [profileRes, eduRes, decRes, posRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, department:departments(id, name)")
      .eq("id", targetUserId)
      .single(),
    supabase
      .from("profile_educations")
      .select("*")
      .eq("profile_id", targetUserId)
      .order("sort_order", { ascending: true })
      .order("graduation_year", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_decorations")
      .select("*")
      .eq("profile_id", targetUserId)
      .order("sort_order", { ascending: true })
      .order("approved_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_admin_positions")
      .select("*")
      .eq("profile_id", targetUserId)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: false }),
  ]);

  if (profileRes.error) {
    console.error(
      "[hr-profile-actions] getUserProfileWithHistory failed:",
      profileRes.error,
    );
    throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
  }

  return {
    profile: profileRes.data,
    educations: eduRes.data ?? [],
    decorations: decRes.data ?? [],
    adminPositions: posRes.data ?? [],
  };
}
