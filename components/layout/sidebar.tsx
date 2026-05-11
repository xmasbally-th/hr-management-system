"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Plane,
  GraduationCap,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Users,
  Building2,
  CalendarRange,
  BookOpen,
  FolderSearch,
  FileInput,
  MapPin,
  Building,
  BarChart3,
  Settings,
  ChevronLeft,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navigationGroups, getNavigationForRole, type NavItem } from "@/lib/navigation";
import type { UserRole } from "@/types/supabase";

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Plane,
  GraduationCap,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Users,
  Building2,
  CalendarRange,
  BookOpen,
  FolderSearch,
  FileInput,
  MapPin,
  Building,
  BarChart3,
  Settings,
};

interface SidebarProps {
  role: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ role, collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const groups = getNavigationForRole(role);
  const widthClass = collapsed ? "w-[76px]" : "w-[264px]";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}
      
      <aside
        className={cn(
          widthClass,
          "sidebar-transition bg-sidebar text-sidebar-foreground flex flex-col",
          "fixed lg:sticky top-0 left-0 h-screen z-50",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform duration-300"
        )}
        aria-label="Primary"
      >
        {/* Logo area */}
        <div className={cn(
          "flex items-center h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center px-3" : "px-5"
        )} style={{ borderColor: "rgb(5, 73, 184)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center shadow-lg shadow-indigo-900/40 shrink-0">
              <span className="text-white font-bold text-sm tracking-tight">HR</span>
            </div>
            {!collapsed && (
              <div className="animate-fade-in min-w-0">
                <div className="text-white font-semibold text-[13px] leading-tight truncate">HR Hybrid Workflow</div>
                <div className="text-sidebar-foreground/70 text-[11px] leading-tight">ระบบจัดการบุคลากร</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          <ul className="space-y-6">
            {groups.map((group) => (
              <li key={group.label} className="flex flex-col gap-1">
                {!collapsed && (
                  <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
                    {group.label}
                  </div>
                )}

                {group.items.map((item) => {
                  const Icon = iconMap[item.icon];
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onMobileClose && onMobileClose()}
                      title={collapsed ? `${item.title}` : ""}
                      className={cn(
                        "group relative w-full flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all",
                        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                        isActive
                          ? "bg-sidebar-primary/15 text-white shadow-[inset_2px_0_0_0] shadow-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/70"
                      )}
                    >
                      <span className={cn("shrink-0", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/90")}>
                        {Icon && <Icon size={19} />}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between min-w-0 animate-fade-in">
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-semibold">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && item.badge && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[9px] font-semibold grid place-items-center">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer / collapse toggle */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-sidebar-accent/40">
              <div className="w-8 h-8 rounded-md bg-sidebar-accent grid place-items-center text-sidebar-foreground/90">
                <HelpCircle size={16} />
              </div>
              <div className="flex-1 min-w-0 animate-fade-in">
                <div className="text-[12px] text-white font-medium leading-tight">ต้องการความช่วยเหลือ?</div>
                <div className="text-[11px] text-sidebar-foreground/60 leading-tight">ติดต่อฝ่าย IT</div>
              </div>
            </div>
          ) : null}
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden lg:flex mt-2 w-full items-center px-2 py-2 rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent text-[12px]",
              collapsed ? "justify-center" : "justify-end gap-2"
            )}
            aria-label="Toggle sidebar"
          >
            <ChevronLeft size={16} className={cn("transition-transform", collapsed ? "rotate-180" : "")} />
            {!collapsed && <span>ย่อเมนู</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
