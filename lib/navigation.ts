import type { UserRole } from "@/types/supabase";

export interface NavItem {
  title: string;
  href: string;
  icon: string; // Lucide icon name — rendered dynamically in sidebar
  badge?: string;
  /** Roles that can see this item. Empty = visible to all. */
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Centralised navigation configuration.
 *
 * Role visibility rules:
 * - admin    → full system access
 * - hr       → HR operations (leaves, trainings, documents)
 * - manager  → team management + approvals
 * - employee → self-service only
 */
export const navigationGroups: NavGroup[] = [
  {
    label: "ภาพรวม",
    items: [
      {
        title: "หน้าหลัก",
        href: "/dashboard",
        icon: "LayoutDashboard",
        roles: ["admin", "hr", "manager", "employee"],
      },
    ],
  },
  {
    label: "บริการส่วนบุคคล",
    items: [
      {
        title: "การลางาน",
        href: "/dashboard/leaves",
        icon: "CalendarDays",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "ปฏิทินงานบุคคล",
        href: "/dashboard/personnel-calendar",
        icon: "CalendarHeart",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "เดินทางไปราชการ",
        href: "/dashboard/travel",
        icon: "Plane",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "การมาปฏิบัติงาน",
        href: "/dashboard/attendance",
        icon: "ClipboardList",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "ประวัติการอบรม",
        href: "/dashboard/trainings",
        icon: "GraduationCap",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "เอกสารของฉัน",
        href: "/dashboard/documents",
        icon: "FileText",
        roles: ["admin", "hr", "manager", "employee"],
      },
    ],
  },
  {
    label: "การจัดการบุคลากร",
    items: [
      {
        title: "จัดการผู้ใช้งาน",
        href: "/dashboard/hr/users",
        icon: "Users",
        roles: ["admin", "hr"],
      },
      {
        title: "อนุมัติคำขอแก้ไขข้อมูล",
        href: "/dashboard/hr/profile-corrections",
        icon: "FileCheck2",
        roles: ["admin", "hr"],
      },
      {
        // Unified leave hub — queue / all requests / overview / doc-tracking.
        // Manager sees it here too (this group surfaces just this item for them).
        title: "จัดการใบลา",
        href: "/dashboard/hr/leaves",
        icon: "CalendarRange",
        roles: ["admin", "hr", "manager"],
      },
      {
        // Unified travel hub — queue / all requests / budget overview /
        // doc-tracking. Mirrors the leave hub; all roles enter through here.
        title: "จัดการเดินทางราชการ",
        href: "/dashboard/hr/travel",
        icon: "Plane",
        roles: ["admin", "hr", "manager"],
      },
      {
        // Monthly attendance summary hub — import the university HR's PDF,
        // review/match the grid, publish. Manager sees it read-only.
        title: "สรุปการมาปฏิบัติงาน",
        href: "/dashboard/hr/attendance",
        icon: "ClipboardCheck",
        roles: ["admin", "hr", "manager"],
      },
      {
        title: "จัดการการอบรม",
        href: "/dashboard/hr/trainings",
        icon: "BookOpen",
        roles: ["admin", "hr"],
      },
      {
        title: "ช่องทางกระดาษ",
        href: "/dashboard/hr/paper-channel",
        icon: "FileInput",
        roles: ["admin", "hr"],
      },
      {
        title: "จัดการวันลา",
        href: "/dashboard/hr/leave-balances",
        icon: "CalendarCog",
        roles: ["admin", "hr"],
      },
    ],
  },
  {
    label: "ระบบ",
    items: [
      {
        title: "รายงาน",
        href: "/dashboard/reports",
        icon: "BarChart3",
        roles: ["admin", "hr", "manager"],
      },
      {
        title: "ข้อมูลหลัก",
        href: "/dashboard/hr/master-data",
        icon: "Building",
        roles: ["admin", "hr"],
      },
      {
        title: "ตั้งค่าระบบ",
        href: "/dashboard/settings",
        icon: "Settings",
        roles: ["admin"],
      },
    ],
  },
];

/**
 * Filter navigation groups based on the user's role.
 * Returns only the groups (and items) the user is authorised to see.
 */
export function getNavigationForRole(role: UserRole): NavGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
