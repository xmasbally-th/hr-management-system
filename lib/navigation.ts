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
        title: "ประวัติการลา",
        href: "/dashboard/leaves",
        icon: "CalendarDays",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "ประวัติการเดินทาง",
        href: "/dashboard/travel",
        icon: "Plane",
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
    label: "การอนุมัติ",
    items: [
      {
        title: "อนุมัติการลา",
        href: "/dashboard/approvals/leaves",
        icon: "ClipboardCheck",
        roles: ["admin", "hr", "manager"],
      },
      {
        title: "อนุมัติการเดินทาง",
        href: "/dashboard/approvals/travel",
        icon: "ClipboardList",
        roles: ["admin", "hr", "manager"],
      },
      {
        title: "ติดตามเอกสาร",
        href: "/dashboard/approvals/documents",
        icon: "FolderSearch",
        roles: ["admin", "hr", "manager"],
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
        title: "จัดการการลา",
        href: "/dashboard/hr/leaves",
        icon: "CalendarRange",
        roles: ["admin", "hr"],
      },
      {
        title: "จัดการเดินทางราชการ",
        href: "/dashboard/hr/travel",
        icon: "MapPin",
        roles: ["admin", "hr"],
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
        title: "ติดตามเอกสาร",
        href: "/dashboard/hr/documents",
        icon: "FolderSearch",
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
