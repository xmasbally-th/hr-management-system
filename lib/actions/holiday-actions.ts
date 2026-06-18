"use server";

/**
 * CRUD server actions for the `holidays` table (ปฏิทินวันหยุดราชการ).
 * HR/Admin only for mutations; any authenticated user can read.
 */

import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { currentFiscalYear } from "@/lib/date-ranges";
import { isHolidayType } from "@/lib/holiday-types";

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

/** Validate + normalize an optional note (≤ 500 chars). Returns null when empty. */
function normalizeNote(note: string | null | undefined): string | null {
  if (note == null) return null;
  const trimmed = note.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) throw new Error("หมายเหตุต้องไม่เกิน 500 ตัวอักษร");
  return trimmed;
}

// ─── Read ──────────────────────────────────────────────────

/**
 * Get holidays for a fiscal year (or current FY if not specified).
 * Any authenticated user can call this.
 */
export async function getHolidays(fiscalYear?: number) {
  const supabase = await createClient();
  await getAuthUser(supabase);

  const fy = fiscalYear ?? currentFiscalYear();

  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .eq("fiscal_year", fy)
    .order("date", { ascending: true });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลวันหยุดราชการได้");
  return data ?? [];
}

// ─── Create ────────────────────────────────────────────────

export async function createHoliday(input: {
  date: string;
  name: string;
  type?: string;
  note?: string | null;
}) {
  if (!ISO_DATE_RE.test(input.date)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
  }
  const name = input.name.trim();
  if (name.length === 0 || name.length > 200) {
    throw new Error("ชื่อวันหยุดต้องมี 1-200 ตัวอักษร");
  }
  const type = input.type ?? "general";
  if (!isHolidayType(type)) {
    throw new Error("หมวดวันหยุดไม่ถูกต้อง");
  }
  const note = normalizeNote(input.note);

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  // Auto-calculate fiscal year from date
  const fiscalYear = currentFiscalYear(new Date(input.date));

  const { data, error } = await supabase
    .from("holidays")
    .insert({
      date: input.date,
      name,
      type,
      note,
      fiscal_year: fiscalYear,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("วันที่นี้มีวันหยุดอยู่แล้ว");
    }
    throw new Error("เพิ่มวันหยุดไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "create_holiday", "holiday", data.id, {
    date: input.date,
    name,
    type,
    note,
    fiscal_year: fiscalYear,
  });

  revalidatePath("/dashboard/hr/master-data");
  return data;
}

// ─── Update ────────────────────────────────────────────────

export async function updateHoliday(
  id: string,
  input: { date?: string; name?: string; type?: string; note?: string | null },
) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) throw new Error("รหัสวันหยุดไม่ถูกต้อง");

  const updates: {
    date?: string;
    name?: string;
    type?: string;
    note?: string | null;
    fiscal_year?: number;
  } = {};

  if (input.date !== undefined) {
    if (!ISO_DATE_RE.test(input.date)) {
      throw new Error("รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)");
    }
    updates.date = input.date;
    updates.fiscal_year = currentFiscalYear(new Date(input.date));
  }

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0 || name.length > 200) {
      throw new Error("ชื่อวันหยุดต้องมี 1-200 ตัวอักษร");
    }
    updates.name = name;
  }

  if (input.type !== undefined) {
    if (!isHolidayType(input.type)) {
      throw new Error("หมวดวันหยุดไม่ถูกต้อง");
    }
    updates.type = input.type;
  }

  if (input.note !== undefined) {
    updates.note = normalizeNote(input.note);
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("ไม่มีข้อมูลที่ต้องอัปเดต");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("holidays")
    .update(updates)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      throw new Error("วันที่นี้มีวันหยุดอยู่แล้ว");
    }
    throw new Error("อัปเดตวันหยุดไม่สำเร็จ");
  }

  await logAudit(supabase, user.id, "update_holiday", "holiday", id, { ...updates });
  revalidatePath("/dashboard/hr/master-data");
}

// ─── Delete ────────────────────────────────────────────────

export async function deleteHoliday(id: string) {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) throw new Error("รหัสวันหยุดไม่ถูกต้อง");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) throw new Error("ลบวันหยุดไม่สำเร็จ");

  await logAudit(supabase, user.id, "delete_holiday", "holiday", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

// ─── Bulk Create ───────────────────────────────────────────

/**
 * Import multiple holidays at once. Skips dates that already exist.
 * Returns the count of successfully inserted holidays.
 */
export async function bulkCreateHolidays(
  holidays: { date: string; name: string }[],
): Promise<{ inserted: number; skipped: number }> {
  if (holidays.length === 0) throw new Error("ไม่มีข้อมูลวันหยุดที่จะนำเข้า");
  if (holidays.length > 100) throw new Error("นำเข้าได้ครั้งละไม่เกิน 100 วัน");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  // Validate all entries
  for (const h of holidays) {
    if (!ISO_DATE_RE.test(h.date)) {
      throw new Error(`รูปแบบวันที่ไม่ถูกต้อง: ${h.date}`);
    }
    const name = h.name.trim();
    if (name.length === 0 || name.length > 200) {
      throw new Error(`ชื่อวันหยุดต้องมี 1-200 ตัวอักษร: "${name}"`);
    }
  }

  // Get existing dates to skip duplicates
  const dates = holidays.map((h) => h.date);
  const { data: existing } = await supabase
    .from("holidays")
    .select("date")
    .in("date", dates);
  const existingDates = new Set((existing ?? []).map((e) => e.date));

  const toInsert = holidays
    .filter((h) => !existingDates.has(h.date))
    .map((h) => ({
      date: h.date,
      name: h.name.trim(),
      fiscal_year: currentFiscalYear(new Date(h.date)),
      created_by: user.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("holidays").insert(toInsert);
    if (error) throw new Error("นำเข้าวันหยุดไม่สำเร็จ");
  }

  const inserted = toInsert.length;
  const skipped = holidays.length - inserted;

  await logAudit(supabase, user.id, "bulk_create_holidays", "holiday", "bulk", {
    inserted,
    skipped,
    dates: toInsert.map((h) => h.date),
  });

  revalidatePath("/dashboard/hr/master-data");
  return { inserted, skipped };
}
