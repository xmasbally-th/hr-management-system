"use server";

/**
 * CRUD server actions for the `exam_periods` table (ช่วงสอบปลายภาค).
 * HR/Admin only for mutations; any authenticated user can read (the
 * leave/travel forms need it to show the advisory warning).
 */

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { currentFiscalYear } from "@/lib/date-ranges";

// ─── Auth helpers ──────────────────────────────────────────

async function getAuthUser(_supabase?: Awaited<ReturnType<typeof createClient>>) {
  const user = await getCachedUser();
  if (!user) throw new Error("Unauthorized: Please log in");
  return user;
}

async function checkHrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) {
    throw new Error("Forbidden: HR/Admin only");
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new Error("ชื่อช่วงสอบต้องมี 1-200 ตัวอักษร");
  }
  return trimmed;
}

function validateDates(startDate: string, endDate: string) {
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  }
  if (endDate < startDate) {
    throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น");
  }
}

// ─── Read ──────────────────────────────────────────────────

/**
 * Get exam periods for a fiscal year (or current FY if not specified).
 * Any authenticated user can call this.
 */
export async function getExamPeriods(fiscalYear?: number) {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const fy = fiscalYear ?? currentFiscalYear();

  const { data, error } = await supabase
    .from("exam_periods")
    .select("*")
    .eq("fiscal_year", fy)
    .order("start_date", { ascending: true });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลช่วงสอบได้");
  return data ?? [];
}

// ─── Create ────────────────────────────────────────────────

export async function createExamPeriod(input: {
  name: string;
  start_date: string;
  end_date: string;
}) {
  const name = validateName(input.name);
  validateDates(input.start_date, input.end_date);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const fiscalYear = currentFiscalYear(new Date(input.start_date));

  const { data, error } = await supabase
    .from("exam_periods")
    .insert({
      name,
      start_date: input.start_date,
      end_date: input.end_date,
      fiscal_year: fiscalYear,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error("เพิ่มช่วงสอบไม่สำเร็จ");

  await logAudit(supabase, user.id, "create_exam_period", "exam_period", data.id, {
    name,
    start_date: input.start_date,
    end_date: input.end_date,
    fiscal_year: fiscalYear,
  });

  revalidatePath("/dashboard/hr/master-data");
  return data;
}

// ─── Update ────────────────────────────────────────────────

export async function updateExamPeriod(
  id: string,
  input: { name?: string; start_date?: string; end_date?: string },
) {
  if (!UUID_RE.test(id)) throw new Error("รหัสช่วงสอบไม่ถูกต้อง");

  const updates: {
    name?: string;
    start_date?: string;
    end_date?: string;
    fiscal_year?: number;
  } = {};

  if (input.name !== undefined) {
    updates.name = validateName(input.name);
  }

  // start/end must be validated together when either changes
  if (input.start_date !== undefined || input.end_date !== undefined) {
    if (input.start_date === undefined || input.end_date === undefined) {
      throw new Error("ต้องระบุทั้งวันเริ่มต้นและวันสิ้นสุด");
    }
    validateDates(input.start_date, input.end_date);
    updates.start_date = input.start_date;
    updates.end_date = input.end_date;
    updates.fiscal_year = currentFiscalYear(new Date(input.start_date));
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("ไม่มีข้อมูลที่ต้องอัปเดต");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("exam_periods")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error("อัปเดตช่วงสอบไม่สำเร็จ");

  await logAudit(supabase, user.id, "update_exam_period", "exam_period", id, { ...updates });
  revalidatePath("/dashboard/hr/master-data");
}

// ─── Delete ────────────────────────────────────────────────

export async function deleteExamPeriod(id: string) {
  if (!UUID_RE.test(id)) throw new Error("รหัสช่วงสอบไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase.from("exam_periods").delete().eq("id", id);
  if (error) throw new Error("ลบช่วงสอบไม่สำเร็จ");

  await logAudit(supabase, user.id, "delete_exam_period", "exam_period", id, {});
  revalidatePath("/dashboard/hr/master-data");
}
