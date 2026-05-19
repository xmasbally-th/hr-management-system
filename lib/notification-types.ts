/**
 * Notification type metadata + canonical type list.
 *
 * Kept in a plain (non-"use server") module so server-action files can
 * import these constants without violating the rule that `"use server"`
 * files only export async functions.
 */

export const ALLOWED_NOTIFICATION_TYPES = [
  "new_leave_request",
  "new_travel_request",
  "leave_approved",
  "leave_rejected",
  "travel_approved",
  "travel_rejected",
  "account_approved",
  "account_rejected",
  "account_pending",
  "profile_edited_by_hr",
] as const;

export type NotificationType = (typeof ALLOWED_NOTIFICATION_TYPES)[number];

export const VALID_NOTIFICATION_TYPE_SET = new Set<string>(
  ALLOWED_NOTIFICATION_TYPES,
);

export interface NotificationTypeMeta {
  type: NotificationType;
  label: string;
  description: string;
  group: "leave" | "travel" | "account" | "profile";
}

/**
 * UI metadata for notification types. The order here drives the
 * preferences screen layout (groups: การลา / การเดินทาง / บัญชี).
 */
export const NOTIFICATION_TYPE_META: NotificationTypeMeta[] = [
  { type: "new_leave_request", label: "ใบลาใหม่รออนุมัติ", description: "แจ้งเมื่อมีใบลาส่งเข้ามาให้คุณพิจารณา", group: "leave" },
  { type: "leave_approved", label: "ใบลาของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อคำขอลาของคุณถูกอนุมัติ", group: "leave" },
  { type: "leave_rejected", label: "ใบลาของฉันถูกปฏิเสธ", description: "แจ้งเมื่อคำขอลาของคุณไม่ได้รับการอนุมัติ", group: "leave" },
  { type: "new_travel_request", label: "คำขอเดินทางใหม่รออนุมัติ", description: "แจ้งเมื่อมีคำขอเดินทางส่งเข้ามาให้คุณพิจารณา", group: "travel" },
  { type: "travel_approved", label: "คำขอเดินทางของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อคำขอเดินทางของคุณถูกอนุมัติ", group: "travel" },
  { type: "travel_rejected", label: "คำขอเดินทางของฉันถูกปฏิเสธ", description: "แจ้งเมื่อคำขอเดินทางของคุณไม่ได้รับการอนุมัติ", group: "travel" },
  { type: "account_approved", label: "บัญชีของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อ HR อนุมัติบัญชีของคุณ", group: "account" },
  { type: "account_rejected", label: "บัญชีของฉันถูกระงับ", description: "แจ้งเมื่อบัญชีของคุณถูกระงับการใช้งาน", group: "account" },
  { type: "account_pending", label: "บัญชีของฉันกลับเป็นรออนุมัติ", description: "แจ้งเมื่อสถานะบัญชีของคุณเปลี่ยนกลับเป็น pending", group: "account" },
  { type: "profile_edited_by_hr", label: "ฝ่ายบุคคลแก้ไขข้อมูลโปรไฟล์ของฉัน", description: "แจ้งเมื่อ HR/Admin มีการแก้ไขข้อมูลในโปรไฟล์ของคุณ", group: "profile" },
];
