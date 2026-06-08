/**
 * Pure helpers for the exam-period advisory feature.
 *
 * Used by the leave/travel forms (and their pages) to decide whether to show
 * the "ช่วงสอบปลายภาค" warning. All date inputs are ISO "YYYY-MM-DD" strings,
 * which sort lexicographically the same as chronologically — so plain string
 * comparison is safe and avoids time-zone pitfalls.
 */

export interface ExamPeriodLike {
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
}

/**
 * Do two inclusive date ranges overlap? Returns false if any bound is missing.
 */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Is the given position title one that carries exam-proctoring duty?
 * Matches when `positionTitle` contains any entry of `dutyPositions`
 * (case-insensitive, trimmed). Empty/blank inputs → false.
 */
export function matchesExamDuty(
  positionTitle: string | null | undefined,
  dutyPositions: string[],
): boolean {
  const title = positionTitle?.trim().toLowerCase();
  if (!title) return false;
  return dutyPositions.some((p) => {
    const needle = p.trim().toLowerCase();
    return needle.length > 0 && title.includes(needle);
  });
}

/**
 * Return the exam periods whose date range overlaps [start, end] (inclusive).
 * Returns [] when start/end are missing.
 */
export function overlappingExamPeriods<T extends ExamPeriodLike>(
  start: string,
  end: string,
  periods: T[],
): T[] {
  if (!start || !end) return [];
  return periods.filter((p) =>
    rangesOverlap(start, end, p.start_date, p.end_date),
  );
}
