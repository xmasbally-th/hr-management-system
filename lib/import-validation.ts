/**
 * Pure client-side validation for the bulk employee import CSV.
 *
 * Lives outside the React component so it's trivially unit-testable
 * and so future variants (e.g. server-side import API) can share the
 * same rules.
 */

// Accepts null because the upstream ImportRow type derived from CSV
// parsing can have nullable optional fields.
export interface ImportValidationRow {
  email?: string | null;
  title_th?: string | null;
  first_name_th?: string | null;
  last_name_th?: string | null;
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  position_number?: string | null;
  position_title?: string | null;
  employee_type?: string | null;
  department_name?: string | null;
  education_level?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  current_address?: string | null;
  role?: string | null;
}

export const REQUIRED_FIELDS = [
  "email",
  "title_th",
  "first_name_th",
  "last_name_th",
  "position_title",
  "employee_type",
  "department_name",
] as const;

export const REQUIRED_FIELD_LABELS: Record<string, string> = {
  email: "อีเมล",
  title_th: "คำนำหน้า (ไทย)",
  first_name_th: "ชื่อ (ไทย)",
  last_name_th: "นามสกุล (ไทย)",
  position_title: "ตำแหน่ง",
  employee_type: "ประเภทบุคลากร",
  department_name: "แผนก",
};

const ALLOWED_ROLES = new Set(["admin", "hr", "manager", "employee"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a single import row. Returns an array of human-readable
 * Thai error messages — empty array means the row is valid.
 *
 * `seenEmails` is mutated to track duplicates within the batch: keys are
 * normalised lowercased emails, values are the 0-based row index of the
 * first occurrence (so a follow-up duplicate can reference it).
 */
export function validateRow(
  row: ImportValidationRow,
  index: number,
  seenEmails: Map<string, number>,
): string[] {
  const errs: string[] = [];

  // Required fields
  for (const f of REQUIRED_FIELDS) {
    const v = (row as Record<string, string | null | undefined>)[f];
    if (v === null || v === undefined || !String(v).trim()) {
      errs.push(`ขาด${REQUIRED_FIELD_LABELS[f] ?? f}`);
    }
  }

  // Email format + duplicates
  const email = (row.email ?? "").trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) {
    errs.push("รูปแบบอีเมลไม่ถูกต้อง");
  }
  if (email && seenEmails.has(email)) {
    const firstSeen = (seenEmails.get(email) ?? 0) + 1; // human row #
    errs.push(`อีเมลซ้ำกับแถว ${firstSeen}`);
  } else if (email) {
    seenEmails.set(email, index);
  }

  // Optional dates — must be ISO if provided
  if (row.birth_date && !ISO_DATE_RE.test(row.birth_date.trim())) {
    errs.push("birth_date ต้องเป็นรูปแบบ YYYY-MM-DD");
  }
  if (row.hire_date && !ISO_DATE_RE.test(row.hire_date.trim())) {
    errs.push("hire_date ต้องเป็นรูปแบบ YYYY-MM-DD");
  }

  // Role allowlist (if provided)
  if (row.role && !ALLOWED_ROLES.has(row.role.trim().toLowerCase())) {
    errs.push("role ต้องเป็น admin / hr / manager / employee");
  }

  return errs;
}
