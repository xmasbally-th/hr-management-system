/**
 * Holiday category constants — shared by the server action validation and
 * the master-data UI. Kept out of the "use server" action file because a
 * "use server" module may only export async functions.
 */

/** หมวดวันหยุด — ต้องตรงกับ CHECK constraint ในตาราง holidays */
export const HOLIDAY_TYPES = ["general", "own_closure", "special"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export function isHolidayType(v: string): v is HolidayType {
  return (HOLIDAY_TYPES as readonly string[]).includes(v);
}
