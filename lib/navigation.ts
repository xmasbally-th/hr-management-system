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
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: "LayoutDashboard",
        roles: ["admin", "hr", "manager", "employee"],
      },
    ],
  },
  {
    label: "Self-Service",
    items: [
      {
        title: "My Leaves",
        href: "/dashboard/leaves",
        icon: "CalendarDays",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "My Travel",
        href: "/dashboard/travel",
        icon: "Plane",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "My Trainings",
        href: "/dashboard/trainings",
        icon: "GraduationCap",
        roles: ["admin", "hr", "manager", "employee"],
      },
      {
        title: "My Documents",
        href: "/dashboard/documents",
        icon: "FileText",
        roles: ["admin", "hr", "manager", "employee"],
      },
    ],
  },
  {
    label: "Approvals",
    items: [
      {
        title: "Leave Approvals",
        href: "/dashboard/approvals/leaves",
        icon: "ClipboardCheck",
        roles: ["admin", "hr", "manager"],
      },
      {
        title: "Travel Approvals",
        href: "/dashboard/approvals/travel",
        icon: "ClipboardList",
        roles: ["admin", "hr", "manager"],
      },
    ],
  },
  {
    label: "HR Management",
    items: [
      {
        title: "Employees",
        href: "/dashboard/hr/employees",
        icon: "Users",
        roles: ["admin", "hr"],
      },
      {
        title: "Departments",
        href: "/dashboard/hr/departments",
        icon: "Building2",
        roles: ["admin", "hr"],
      },
      {
        title: "Leave Management",
        href: "/dashboard/hr/leaves",
        icon: "CalendarRange",
        roles: ["admin", "hr"],
      },
      {
        title: "Training Management",
        href: "/dashboard/hr/trainings",
        icon: "BookOpen",
        roles: ["admin", "hr"],
      },
      {
        title: "Document Tracking",
        href: "/dashboard/hr/documents",
        icon: "FolderSearch",
        roles: ["admin", "hr"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Reports",
        href: "/dashboard/reports",
        icon: "BarChart3",
        roles: ["admin", "hr"],
      },
      {
        title: "Settings",
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
