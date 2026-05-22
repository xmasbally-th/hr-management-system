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
  "leave_status_update",
  "travel_approved",
  "travel_rejected",
  "account_approved",
  "account_rejected",
  "account_pending",
  "profile_edited_by_hr",
  "correction_resolved",
  "correction_rejected",
  "user_profile_confirmed",
  "new_correction_request",
] as const;

export type NotificationType = (typeof ALLOWED_NOTIFICATION_TYPES)[number];

export const VALID_NOTIFICATION_TYPE_SET = new Set<string>(
  ALLOWED_NOTIFICATION_TYPES,
);

export interface NotificationTypeMeta {
  type: NotificationType;
  label: string;
  description: string;
  group: "leave" | "travel" | "account" | "profile" | "hr_inbox";
}

/**
 * UI metadata for notification types. The order here drives the
 * preferences screen layout (groups: การลา / การเดินทาง / บัญชี).
 */
export const NOTIFICATION_TYPE_META: NotificationTypeMeta[] = [
  { type: "new_leave_request", label: "ใบลาใหม่รออนุมัติ", description: "แจ้งเมื่อมีใบลาส่งเข้ามาให้คุณพิจารณา", group: "leave" },
  { type: "leave_approved", label: "ใบลาของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อคำขอลาของคุณถูกอนุมัติ", group: "leave" },
  { type: "leave_rejected", label: "ใบลาของฉันถูกปฏิเสธ", description: "แจ้งเมื่อคำขอลาของคุณไม่ได้รับการอนุมัติ", group: "leave" },
  { type: "leave_status_update", label: "ความคืบหน้าใบลาของฉัน", description: "แจ้งเมื่อใบลาของคุณเดินเอกสารแต่ละขั้น (ส่งผอ./ผอ.เซ็น/ส่งคณบดี/คณบดีเซ็น/ส่งมหาวิทยาลัย)", group: "leave" },
  { type: "new_travel_request", label: "คำขอเดินทางใหม่รออนุมัติ", description: "แจ้งเมื่อมีคำขอเดินทางส่งเข้ามาให้คุณพิจารณา", group: "travel" },
  { type: "travel_approved", label: "คำขอเดินทางของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อคำขอเดินทางของคุณถูกอนุมัติ", group: "travel" },
  { type: "travel_rejected", label: "คำขอเดินทางของฉันถูกปฏิเสธ", description: "แจ้งเมื่อคำขอเดินทางของคุณไม่ได้รับการอนุมัติ", group: "travel" },
  { type: "account_approved", label: "บัญชีของฉันได้รับการอนุมัติ", description: "แจ้งเมื่อ HR อนุมัติบัญชีของคุณ", group: "account" },
  { type: "account_rejected", label: "บัญชีของฉันถูกระงับ", description: "แจ้งเมื่อบัญชีของคุณถูกระงับการใช้งาน", group: "account" },
  { type: "account_pending", label: "บัญชีของฉันกลับเป็นรออนุมัติ", description: "แจ้งเมื่อสถานะบัญชีของคุณเปลี่ยนกลับเป็น pending", group: "account" },
  { type: "profile_edited_by_hr", label: "ฝ่ายบุคคลแก้ไขข้อมูลโปรไฟล์ของฉัน", description: "แจ้งเมื่อ HR/Admin มีการแก้ไขข้อมูลในโปรไฟล์ของคุณ", group: "profile" },
  { type: "correction_resolved", label: "คำขอแก้ไขของฉันได้รับการดำเนินการ", description: "แจ้งเมื่อ HR ดำเนินการคำขอแก้ไขข้อมูลของคุณเสร็จสิ้น", group: "profile" },
  { type: "correction_rejected", label: "คำขอแก้ไขของฉันถูกปฏิเสธ", description: "แจ้งเมื่อ HR ปฏิเสธคำขอแก้ไขข้อมูลของคุณ", group: "profile" },
  { type: "user_profile_confirmed", label: "มีผู้ใช้ยืนยันโปรไฟล์ใหม่", description: "[HR/Admin] แจ้งเมื่อผู้ใช้ยืนยันข้อมูลโปรไฟล์ครั้งแรกหลังเข้าสู่ระบบ", group: "hr_inbox" },
  { type: "new_correction_request", label: "มีคำขอแก้ไขข้อมูลใหม่", description: "[HR/Admin] แจ้งเมื่อผู้ใช้ส่งคำขอแก้ไขข้อมูลโปรไฟล์", group: "hr_inbox" },
];

/**
 * System-wide settings per notification type (Phase S11). Mirrors the
 * notification_type_settings table. Used as a fallback when the table is
 * empty / not yet migrated, and as the seed/reference for the admin UI.
 */
export interface NotificationTypeSetting {
  type: NotificationType;
  enabled: boolean;
  realtime_enabled: boolean;
  cooldown_seconds: number;
  recipient_roles: Record<"admin" | "hr" | "manager" | "employee", boolean>;
}

const ALL_ROLES = { admin: true, hr: true, manager: true, employee: true };
const HR_ONLY = { admin: true, hr: true, manager: false, employee: false };
const HR_MANAGER = { admin: false, hr: true, manager: true, employee: false };

/**
 * Default settings — kept in sync with the seed in
 * supabase/migrations/20260525_notification_type_settings.sql.
 */
export const DEFAULT_TYPE_SETTINGS: Record<NotificationType, NotificationTypeSetting> = {
  new_leave_request:      { type: "new_leave_request",      enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: HR_MANAGER },
  new_travel_request:     { type: "new_travel_request",     enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: HR_MANAGER },
  leave_approved:         { type: "leave_approved",         enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  leave_rejected:         { type: "leave_rejected",         enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  leave_status_update:    { type: "leave_status_update",    enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  travel_approved:        { type: "travel_approved",        enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  travel_rejected:        { type: "travel_rejected",        enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  account_approved:       { type: "account_approved",       enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  account_rejected:       { type: "account_rejected",       enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  account_pending:        { type: "account_pending",        enabled: true, realtime_enabled: false, cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  profile_edited_by_hr:   { type: "profile_edited_by_hr",   enabled: true, realtime_enabled: false, cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  correction_resolved:    { type: "correction_resolved",    enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  correction_rejected:    { type: "correction_rejected",    enabled: true, realtime_enabled: true,  cooldown_seconds: 0,  recipient_roles: ALL_ROLES },
  user_profile_confirmed: { type: "user_profile_confirmed", enabled: true, realtime_enabled: true,  cooldown_seconds: 10, recipient_roles: HR_ONLY },
  new_correction_request: { type: "new_correction_request", enabled: true, realtime_enabled: true,  cooldown_seconds: 5,  recipient_roles: HR_ONLY },
};
