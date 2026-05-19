/**
 * Profile completion metric — single source of truth for "how complete is
 * a user's profile?" used in both /dashboard/profile (own view) and
 * /dashboard/hr/users (HR overview).
 *
 * 17 fields counted. Keeping the list short and the function pure makes
 * it cheap to call per row in a server-rendered table.
 */

export const COMPLETION_FIELDS = [
  "title_th",
  "first_name_th",
  "last_name_th",
  "title_en",
  "first_name_en",
  "last_name_en",
  "phone",
  "position_number",
  "position_title",
  "employee_type",
  "department_id",
  "education_level",
  "birth_date",
  "hire_date",
  "gender",
  "current_address",
  "avatar_url",
] as const;

export type CompletionField = (typeof COMPLETION_FIELDS)[number];

/**
 * Returns the completion percentage (0–100, integer) for a profile-like
 * object. Tolerates `null`, `undefined`, and whitespace-only strings —
 * all treated as "missing".
 */
export function completionPct(profile: Record<string, unknown>): number {
  if (!profile) return 0;
  const filled = COMPLETION_FIELDS.filter((f) => {
    const v = profile[f];
    if (v === null || v === undefined) return false;
    return String(v).trim().length > 0;
  }).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}
