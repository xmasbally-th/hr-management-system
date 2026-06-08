/**
 * Pure date helpers for the Thai (พ.ศ.) date picker.
 *
 * All public dates are ISO `YYYY-MM-DD` **Gregorian** (ค.ศ.) strings — the same
 * shape a native `<input type="date">` produces — so storage/validation logic is
 * unaffected. Parsing never goes through `new Date(isoString)` (which would apply
 * a UTC offset and can shift the day), only through explicit numeric parts.
 */

export interface DateParts {
  y: number;
  m: number; // 1–12
  d: number;
}

/** Gregorian year → Buddhist-Era year (e.g. 2026 → 2569). */
export function buddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/** Parse `YYYY-MM-DD` into numeric parts. Returns null if malformed. No time zone. */
export function parseISODate(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Build a zero-padded `YYYY-MM-DD` string from numeric parts. */
export function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Number of days in a given month (m is 1–12). */
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** Weekday of the 1st of the month: 0=Sunday … 6=Saturday. */
export function firstWeekday(y: number, m: number): number {
  return new Date(y, m - 1, 1).getDay();
}

/** Clamp a day to the number of days that actually exist in the month. */
export function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, daysInMonth(y, m));
}

/**
 * First Gregorian year of the 12-year page that `year` belongs to, used by the
 * decade (year) view. Pages are aligned on multiples of 12.
 */
export function yearPageStart(year: number): number {
  return year - (((year % 12) + 12) % 12);
}
