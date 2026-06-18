"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { ISO_DATE_RE } from "@/lib/actions/validators";

/**
 * Server actions that operate on the current user's own profile.
 * Distinct from `user-actions.ts` (HR/Admin-only management of others).
 */

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized");
  return user;
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

// =============================================================================
// First-login confirmation (Phase M3)
// =============================================================================

export interface ConfirmProfileInput {
  // Required identity
  title_th: string;
  first_name_th: string;
  last_name_th: string;
  phone: string;
  position_title: string;
  position_number: string;
  employee_type: string;
  department_id: string;

  // Optional (encouraged)
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  education_level?: string | null;
  current_address?: string | null;
}

const REQUIRED_FIELDS: Array<keyof ConfirmProfileInput> = [
  "title_th",
  "first_name_th",
  "last_name_th",
  "phone",
  "position_title",
  "position_number",
  "employee_type",
  "department_id",
];

/**
 * First-login completion — sets `profile_completed_at` so the proxy stops
 * redirecting the user to `/dashboard/welcome`.
 *
 * Also rebuilds `full_name` from title/first/last (Thai) for display.
 */
export async function confirmProfile(input: ConfirmProfileInput): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  // Required field check
  for (const f of REQUIRED_FIELDS) {
    const v = input[f];
    if (!v || typeof v !== "string" || v.trim().length === 0) {
      throw new Error(`กรุณากรอก: ${labelOf(f)}`);
    }
  }

  validateOptionalDate(trim(input.birth_date), "วันเดือนปีเกิด");
  validateOptionalDate(trim(input.hire_date), "วันที่เริ่มทำงาน");

  const title = input.title_th.trim();
  const first = input.first_name_th.trim();
  const last = input.last_name_th.trim();
  const fullName = `${title} ${first} ${last}`.trim().replace(/\s+/g, " ");

  const update = {
    title_th: title,
    first_name_th: first,
    last_name_th: last,
    title_en: trim(input.title_en),
    first_name_en: trim(input.first_name_en),
    last_name_en: trim(input.last_name_en),
    phone: input.phone.trim(),
    position_title: input.position_title.trim(),
    position_number: input.position_number.trim(),
    employee_type: input.employee_type.trim(),
    department_id: input.department_id,
    gender: trim(input.gender),
    birth_date: trim(input.birth_date),
    hire_date: trim(input.hire_date),
    education_level: trim(input.education_level),
    current_address: trim(input.current_address),
    full_name: fullName,
    profile_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    console.error("[profile-actions] confirmProfile failed:", error);
    throw new Error("บันทึกข้อมูลไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "confirm_profile", "profile", user.id, {
    department_id: input.department_id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/welcome");
}

function labelOf(field: keyof ConfirmProfileInput): string {
  return (
    {
      title_th: "คำนำหน้า (ไทย)",
      first_name_th: "ชื่อ (ไทย)",
      last_name_th: "นามสกุล (ไทย)",
      phone: "เบอร์โทรศัพท์",
      position_title: "ตำแหน่ง",
      position_number: "เลขที่ตำแหน่ง",
      employee_type: "ประเภทบุคลากร",
      department_id: "สังกัดหน่วยงาน",
    } as Partial<Record<keyof ConfirmProfileInput, string>>
  )[field] ?? String(field);
}

// =============================================================================
// Generic self-service profile update (Phase M4 will extend this)
// =============================================================================

export async function getMyProfile() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("profiles")
    .select("*, department:departments(id, name)")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("[profile-actions] getMyProfile failed:", error);
    throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
  }
  return data;
}

export async function getMyProfileWithHistory() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const [profileRes, eduRes, decRes, posRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*, department:departments(id, name)")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profile_educations")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order", { ascending: true })
      .order("graduation_year", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_decorations")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order", { ascending: true })
      .order("approved_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("profile_admin_positions")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: false }),
  ]);

  if (profileRes.error) {
    console.error("[profile-actions] getMyProfileWithHistory failed:", profileRes.error);
    throw new Error("ไม่สามารถดึงข้อมูลโปรไฟล์ได้");
  }

  return {
    profile: profileRes.data,
    educations: eduRes.data ?? [],
    decorations: decRes.data ?? [],
    adminPositions: posRes.data ?? [],
  };
}

// =============================================================================
// updateMyProfile (Phase M4) — self-service edit of identity + position fields
// =============================================================================

export interface UpdateMyProfileInput {
  title_th?: string | null;
  first_name_th?: string | null;
  last_name_th?: string | null;
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  phone?: string | null;
  position_title?: string | null;
  position_number?: string | null;
  employee_type?: string | null;
  department_id?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  education_level?: string | null;
  current_address?: string | null;
}

export async function updateMyProfile(input: UpdateMyProfileInput): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  validateOptionalDate(trim(input.birth_date), "วันเดือนปีเกิด");
  validateOptionalDate(trim(input.hire_date), "วันที่เริ่มทำงาน");

  const titleTh = trim(input.title_th);
  const firstTh = trim(input.first_name_th);
  const lastTh = trim(input.last_name_th);

  const fullName =
    titleTh || firstTh || lastTh
      ? [titleTh, firstTh, lastTh].filter(Boolean).join(" ").replace(/\s+/g, " ")
      : null;

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
    department_id: input.department_id ?? null,
    gender: trim(input.gender),
    birth_date: trim(input.birth_date),
    hire_date: trim(input.hire_date),
    education_level: trim(input.education_level),
    current_address: trim(input.current_address),
    updated_at: new Date().toISOString(),
    ...(fullName ? { full_name: fullName } : {}),
  };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    console.error("[profile-actions] updateMyProfile failed:", error);
    throw new Error("บันทึกข้อมูลไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "update_profile", "profile", user.id, {});
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard");
}

// =============================================================================
// Avatar — accepts a path returned by the storage client-side upload.
// =============================================================================

export async function updateMyAvatar(avatarUrl: string | null): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("[profile-actions] updateMyAvatar failed:", error);
    throw new Error("บันทึกรูปภาพไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "update_avatar", "profile", user.id, {
    has_avatar: !!avatarUrl,
  });
  revalidatePath("/dashboard/profile");
}

// =============================================================================
// profile_educations — CRUD
// =============================================================================

export interface EducationInput {
  entry_year?: number | null;
  graduation_year?: number | null;
  institution: string;
  country?: string | null;
  degree: string;
  program_name?: string | null;
  major_field?: string | null;
}

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

export async function addEducation(input: EducationInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  validateEducation(input);

  const { data, error } = await supabase
    .from("profile_educations")
    .insert({
      profile_id: user.id,
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
  revalidatePath("/dashboard/profile");
  return data;
}

export async function updateEducation(id: string, input: EducationInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
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
    .eq("profile_id", user.id);
  if (error) throw new Error("แก้ไขประวัติการศึกษาไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}

export async function deleteEducation(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("profile_educations")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);
  if (error) throw new Error("ลบประวัติการศึกษาไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}

// =============================================================================
// profile_decorations — CRUD
// =============================================================================

export interface DecorationInput {
  decoration_name: string;
  abbreviation?: string | null;
  document_reference?: string | null;
  approved_date?: string | null;
  position_at_grant?: string | null;
}

function validateDecoration(d: DecorationInput) {
  if (!d.decoration_name?.trim()) throw new Error("กรุณาระบุชื่อเครื่องราชอิสริยาภรณ์");
  validateOptionalDate(trim(d.approved_date), "วันที่อนุมัติ");
}

export async function addDecoration(input: DecorationInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  validateDecoration(input);

  const { data, error } = await supabase
    .from("profile_decorations")
    .insert({
      profile_id: user.id,
      decoration_name: input.decoration_name.trim(),
      abbreviation: trim(input.abbreviation),
      document_reference: trim(input.document_reference),
      approved_date: trim(input.approved_date),
      position_at_grant: trim(input.position_at_grant),
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มเครื่องราชอิสริยาภรณ์ไม่สำเร็จ: " + error.message);
  revalidatePath("/dashboard/profile");
  return data;
}

export async function updateDecoration(id: string, input: DecorationInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
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
    .eq("profile_id", user.id);
  if (error) throw new Error("แก้ไขเครื่องราชอิสริยาภรณ์ไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}

export async function deleteDecoration(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("profile_decorations")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);
  if (error) throw new Error("ลบเครื่องราชอิสริยาภรณ์ไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}

// =============================================================================
// profile_admin_positions — CRUD
// =============================================================================

export interface AdminPositionInput {
  appointment_order_number?: string | null;
  position_title: string;
  responsible_unit?: string | null;
  start_date: string;
  end_date?: string | null;
}

function validateAdminPosition(p: AdminPositionInput) {
  if (!p.position_title?.trim()) throw new Error("กรุณาระบุตำแหน่ง");
  if (!p.start_date?.trim()) throw new Error("กรุณาระบุวันเริ่มปฏิบัติงาน");
  if (!ISO_DATE_RE.test(p.start_date)) throw new Error("วันเริ่มปฏิบัติงานไม่ถูกต้อง");
  if (p.end_date) {
    if (!ISO_DATE_RE.test(p.end_date)) throw new Error("วันสิ้นสุดไม่ถูกต้อง");
    if (p.end_date < p.start_date) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  }
}

export async function addAdminPosition(input: AdminPositionInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
  validateAdminPosition(input);

  const { data, error } = await supabase
    .from("profile_admin_positions")
    .insert({
      profile_id: user.id,
      appointment_order_number: trim(input.appointment_order_number),
      position_title: input.position_title.trim(),
      responsible_unit: trim(input.responsible_unit),
      start_date: input.start_date,
      end_date: trim(input.end_date),
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มประวัติการบริหารไม่สำเร็จ: " + error.message);
  revalidatePath("/dashboard/profile");
  return data;
}

export async function updateAdminPosition(id: string, input: AdminPositionInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);
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
    .eq("profile_id", user.id);
  if (error) throw new Error("แก้ไขประวัติการบริหารไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}

export async function deleteAdminPosition(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const { error } = await supabase
    .from("profile_admin_positions")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);
  if (error) throw new Error("ลบประวัติการบริหารไม่สำเร็จ");
  revalidatePath("/dashboard/profile");
}
