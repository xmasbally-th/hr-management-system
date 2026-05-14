"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { ISO_DATE_RE } from "@/lib/actions/validators";

/**
 * Server actions that operate on the current user's own profile.
 * Distinct from `user-actions.ts` (HR/Admin-only management of others).
 */

async function getAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
