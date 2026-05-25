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
 * Parse a "YYYY-MM-DD" string into a Date at LOCAL midnight.
 *
 * `new Date("2026-05-25")` is parsed as UTC midnight, which means
 * `getDay()` (local) may return the previous day on servers west of
 * UTC. Building from components fixes that — every read on the
 * returned Date is consistent local-time.
 */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Count every calendar day between `startDate` and `endDate` (inclusive).
 * Returns 0 if endDate < startDate.
 */
export function calculateCalendarDays(
  startDate: string,
  endDate: string,
): number {
  const s = parseLocalDate(startDate);
  const e = parseLocalDate(endDate);
  const diff = Math.round(
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
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const dayOfWeek = cursor.getDay(); // local: 0=Sun, 6=Sat
    // Build the ISO date from local components (not toISOString — that
    // would shift to UTC and pick the wrong holiday key on negative-offset
    // servers).
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

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
