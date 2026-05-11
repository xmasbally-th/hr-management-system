/**
 * Shared validation helpers for server actions.
 *
 * Pure functions (no DB calls) are exported directly.
 * `validateEmployeeExists` requires a supabase client.
 */
import type { createClient } from "@/lib/supabase/server";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that the given string is a valid UUID v4 format.
 * Throws with a Thai error message if invalid.
 */
export function validateUUID(value: string, label = "รหัส"): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`${label}ไม่ถูกต้อง`);
  }
}

/**
 * Validates start_date / end_date / total_days for leave & travel requests.
 * - Both dates must be ISO format (YYYY-MM-DD)
 * - start_date must not be after end_date
 * - total_days must be a finite positive number
 */
export function validateRequestDates(
  startDate: string,
  endDate: string,
  totalDays: number,
): void {
  if (!ISO_DATE_RE.test(startDate) || !ISO_DATE_RE.test(endDate)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)");
  }
  if (startDate > endDate) {
    throw new Error("วันที่เริ่มต้องไม่หลังวันที่สิ้นสุด");
  }
  if (!Number.isFinite(totalDays) || totalDays <= 0) {
    throw new Error("จำนวนวันต้องมากกว่า 0");
  }
}

/**
 * Strips HTML tags and trims whitespace to prevent stored XSS.
 */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Validates string length and sanitizes input.
 * Returns the sanitized string, or null if input is empty/null.
 * Throws if the sanitized result exceeds maxLength.
 */
export function validateTextField(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  if (value == null || value.trim() === "") return null;
  const sanitized = sanitizeText(value);
  if (sanitized.length > maxLength) {
    throw new Error(`${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`);
  }
  return sanitized;
}

/**
 * Validates that the employee exists in profiles with status "approved".
 * Also validates UUID format before querying.
 */
export async function validateEmployeeExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
): Promise<void> {
  validateUUID(employeeId, "รหัสพนักงาน");

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", employeeId)
    .eq("status", "approved")
    .single();

  if (!data) {
    throw new Error("ไม่พบพนักงานในระบบ หรือบัญชียังไม่ได้รับการอนุมัติ");
  }
}
