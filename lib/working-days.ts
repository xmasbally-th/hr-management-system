/**
 * Working-days calculator for the leave system.
 *
 * "วันทำการ" = weekdays (Mon–Fri) minus government holidays stored in
 * the `holidays` table.  The calendar-days helper counts every day
 * (used for female maternity leave which counts holidays).
 *
 * Both functions treat start and end as **inclusive**.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// ─── Calendar days (no DB needed) ───────────────────────────

/**
 * Count every calendar day between `startDate` and `endDate` (inclusive).
 * Returns 0 if endDate < startDate.
 */
export function calculateCalendarDays(
  startDate: string,
  endDate: string,
): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = Math.floor(
    (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diff >= 0 ? diff + 1 : 0;
}

// ─── Working days (requires holidays from DB) ───────────────

/**
 * Count working days (Mon–Fri, excluding holidays) between two dates
 * (inclusive). Queries the `holidays` table for the date range.
 *
 * @returns number of working days (≥ 0)
 */
export async function calculateWorkingDays(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<number> {
  // 1. Fetch holidays in the date range
  const holidaySet = await fetchHolidaySet(supabase, startDate, endDate);

  // 2. Loop through each day, counting weekdays that are not holidays
  return countWorkingDays(startDate, endDate, holidaySet);
}

// ─── Internals ──────────────────────────────────────────────

/**
 * Fetch holidays between start and end into a Set of "YYYY-MM-DD" strings
 * for O(1) lookup.
 */
async function fetchHolidaySet(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("holidays")
    .select("date")
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    console.warn("[working-days] Failed to fetch holidays:", error.message);
    // Fail open — count weekdays only (no holiday deductions)
    return new Set();
  }

  return new Set((data ?? []).map((h) => h.date));
}

/**
 * Pure function: count weekdays (Mon–Fri) in [startDate, endDate] that
 * are NOT in the holiday set.
 */
function countWorkingDays(
  startDate: string,
  endDate: string,
  holidays: Set<string>,
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const dayOfWeek = cursor.getDay(); // 0=Sun, 6=Sat
    const iso = cursor.toISOString().slice(0, 10); // YYYY-MM-DD

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(iso)) {
      count++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

// ─── Exports for testing ────────────────────────────────────

/** @internal — exposed for unit tests only */
export const __testHelpers = {
  countWorkingDays,
  fetchHolidaySet,
};
