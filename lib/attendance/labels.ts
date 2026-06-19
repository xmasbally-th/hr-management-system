/** Shared labels/helpers for the attendance summary UI. */

export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export function thaiMonth(month: number): string {
  return THAI_MONTHS[month - 1] ?? `เดือน ${month}`;
}

/** "มกราคม 2569" */
export function periodLabel(month: number, buddhistYear: number): string {
  return `${thaiMonth(month)} ${buddhistYear}`;
}

/** Day-count columns shown in the grid, left→right, with Thai headers. */
export const DAY_COLUMNS = [
  { key: "work_days", label: "วันทำงาน" },
  { key: "travel_days", label: "ไปราชการ" },
  { key: "leave_vacation", label: "ลาพักผ่อน" },
  { key: "leave_personal", label: "ลากิจ" },
  { key: "leave_sick", label: "ลาป่วย" },
  { key: "leave_study", label: "ลาศึกษาต่อ" },
  { key: "leave_maternity", label: "ลาคลอด" },
  { key: "leave_ordination", label: "ลาอุปสมบท" },
] as const;

export const COUNT_COLUMNS = [
  { key: "late_online_days", label: "ลงเวลาสาย" },
  { key: "missing_checkout_count", label: "ไม่ลงเวลาออก" },
] as const;

/** Leave-type column key → Thai label (used by reports). */
export const LEAVE_TYPE_LABELS: Record<string, string> = {
  leave_vacation: "ลาพักผ่อน",
  leave_personal: "ลากิจ",
  leave_sick: "ลาป่วย",
  leave_study: "ลาศึกษาต่อ",
  leave_maternity: "ลาคลอด",
  leave_ordination: "ลาอุปสมบท",
  leave_spouse_childbirth: "ลาช่วยเหลือภริยาที่คลอดบุตร",
};

/** Leave columns of the ANNUAL form, left→right, each carried as ครั้ง/วัน. */
export const ANNUAL_LEAVE_COLUMNS = [
  { key: "leave_sick", label: "ลาป่วย" },
  { key: "leave_personal", label: "ลากิจ" },
  { key: "leave_vacation", label: "ลาพักผ่อน" },
  { key: "leave_maternity", label: "ลาคลอด" },
  { key: "leave_ordination", label: "ลาอุปสมบท" },
  { key: "leave_spouse_childbirth", label: "ลาช่วยเหลือภริยาฯ" },
] as const;

/** "ปีงบประมาณ 2569" */
export function fiscalYearLabel(buddhistYear: number): string {
  return `ปีงบประมาณ ${buddhistYear}`;
}

/**
 * Thai fiscal year (ปีงบประมาณ) runs 1 Oct – 30 Sep. ปีงบฯ N covers
 * Oct–Dec of (N−1) and Jan–Sep of N. So Oct/Nov/Dec roll into next year.
 */
export function fiscalYearOf(buddhistYear: number, month: number): number {
  return month >= 10 ? buddhistYear + 1 : buddhistYear;
}

/** Position of a calendar month within the fiscal year (Oct=1 … Sep=12). */
export function fiscalMonthOrder(month: number): number {
  return month >= 10 ? month - 9 : month + 3;
}

export const STAFF_LINE_LABELS: Record<string, string> = {
  academic: "สายวิชาการ",
  support: "สายสนับสนุน",
  contract: "ลูกจ้าง",
};
