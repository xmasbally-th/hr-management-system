/**
 * Date-range presets for reports — calendar year, fiscal year (Oct 1 – Sep 30),
 * and performance evaluation cycle (Oct–Mar / Apr–Sep).
 *
 * All dates are returned as ISO `YYYY-MM-DD` strings (no time zone).
 * Years are stored as Gregorian (ค.ศ.) internally but the formatter
 * helpers produce พ.ศ. (Buddhist Era) labels for the UI.
 */

export type RangePreset =
  | "calendar-year"
  | "fiscal-year"
  | "performance-h1"
  | "performance-h2"
  | "custom";

export interface DateRange {
  start: string; // YYYY-MM-DD (inclusive)
  end: string; // YYYY-MM-DD (inclusive)
  label: string;
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function thaiYear(year: number): number {
  return year + 543;
}

/**
 * Calendar year N: Jan 1 – Dec 31 of year N (Gregorian).
 */
export function calendarYearRange(year: number): DateRange {
  return {
    start: iso(year, 1, 1),
    end: iso(year, 12, 31),
    label: `ปี ${thaiYear(year)}`,
  };
}

/**
 * Fiscal year N (Thai government): Oct 1 of (N−1) – Sep 30 of N (Gregorian).
 * So FY 2569 = 2025-10-01 to 2026-09-30.
 *
 * The argument `fyYear` is the **Buddhist Era year** the fiscal year is
 * named after (i.e. the year containing Sep 30). Pass the Gregorian
 * equivalent if you prefer — the helper accepts either by sniffing range.
 */
export function fiscalYearRange(fyYear: number): DateRange {
  // Accept either ค.ศ. or พ.ศ.; assume > 2500 is พ.ศ.
  const ce = fyYear > 2500 ? fyYear - 543 : fyYear;
  return {
    start: iso(ce - 1, 10, 1),
    end: iso(ce, 9, 30),
    label: `ปีงบประมาณ ${thaiYear(ce)}`,
  };
}

/**
 * Performance evaluation cycle.
 *   half = 1 → Oct 1 of (year−1) – Mar 31 of (year)        (รอบที่ 1)
 *   half = 2 → Apr 1 of (year)   – Sep 30 of (year)        (รอบที่ 2)
 *
 * Year semantics match fiscalYearRange: `cycleYear` is the FY this cycle
 * belongs to. Cycle 1 of FY 2569 = Oct 2025 – Mar 2026.
 */
export function performanceCycleRange(cycleYear: number, half: 1 | 2): DateRange {
  const ce = cycleYear > 2500 ? cycleYear - 543 : cycleYear;
  if (half === 1) {
    return {
      start: iso(ce - 1, 10, 1),
      end: iso(ce, 3, 31),
      label: `รอบประเมินที่ 1 ปีงบประมาณ ${thaiYear(ce)}`,
    };
  }
  return {
    start: iso(ce, 4, 1),
    end: iso(ce, 9, 30),
    label: `รอบประเมินที่ 2 ปีงบประมาณ ${thaiYear(ce)}`,
  };
}

/**
 * Returns the fiscal year (Gregorian) that the given date falls into.
 *   Oct 2024 → FY 2025
 *   Mar 2025 → FY 2025
 *   Apr 2025 → FY 2025
 *   Sep 2025 → FY 2025
 *   Oct 2025 → FY 2026
 */
export function currentFiscalYear(today: Date = new Date()): number {
  const m = today.getMonth(); // 0-indexed
  const y = today.getFullYear();
  return m >= 9 ? y + 1 : y; // Oct (9) and later → next FY
}

/** Performance cycle (year + half) that the given date falls into. */
export function currentCycle(today: Date = new Date()): {
  year: number;
  half: 1 | 2;
} {
  const fy = currentFiscalYear(today);
  const m = today.getMonth(); // 0=Jan ... 11=Dec
  // Cycle 1 = Oct–Mar (months 9, 10, 11, 0, 1, 2)
  // Cycle 2 = Apr–Sep (months 3, 4, 5, 6, 7, 8)
  const half = m >= 9 || m <= 2 ? 1 : 2;
  return { year: fy, half };
}

/**
 * Returns a small selection of FY years for dropdowns: 5 past + current
 * + 1 future. Always returned as Gregorian (callers can convert with
 * `thaiYear()` for display).
 */
export function getFiscalYearOptions(today: Date = new Date()): number[] {
  const cur = currentFiscalYear(today);
  return [cur - 5, cur - 4, cur - 3, cur - 2, cur - 1, cur, cur + 1];
}

/**
 * Resolve a preset + year (and optional custom start/end) into a concrete
 * DateRange. Returns `null` if the preset is "custom" but start/end are missing.
 */
export function resolveRange(
  preset: RangePreset,
  year: number,
  customStart?: string,
  customEnd?: string,
): DateRange | null {
  if (preset === "calendar-year") return calendarYearRange(year);
  if (preset === "fiscal-year") return fiscalYearRange(year);
  if (preset === "performance-h1") return performanceCycleRange(year, 1);
  if (preset === "performance-h2") return performanceCycleRange(year, 2);
  if (preset === "custom" && customStart && customEnd) {
    return {
      start: customStart,
      end: customEnd,
      label: `${formatThai(customStart)} – ${formatThai(customEnd)}`,
    };
  }
  return null;
}

/** Format a YYYY-MM-DD ISO string as "1 ต.ค. 2568" (Thai short date). */
export function formatThai(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${d} ${months[m - 1]} ${thaiYear(y)}`;
}
