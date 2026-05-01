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
  BarChart3,
  Settings,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavigationForRole, type NavGroup } from "@/lib/navigation";
import type { UserRole } from "@/types/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ─── Icon registry ────────────────────────────────────────────────────
// Direct imports instead of barrel-file dynamic lookup (Vercel best practice §2.1)
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
  BarChart3,
  Settings,
};

interface SidebarProps {
  role: UserRole;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ role, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const groups = getNavigationForRole(role);

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
        "pt-16", // offset for top navbar
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Collapse toggle */}
      <div className="flex justify-end px-3 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "size-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="flex flex-col gap-1 pb-4">
          {groups.map((group, groupIdx) => (
            <SidebarGroup
              key={group.label}
              group={group}
              collapsed={collapsed}
              pathname={pathname}
              isFirst={groupIdx === 0}
            />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// ─── Sidebar group ────────────────────────────────────────────────────

function SidebarGroup({
  group,
  collapsed,
  pathname,
  isFirst,
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  isFirst: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!isFirst && <Separator className="my-2" />}

      {!collapsed && (
        <span className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {group.label}
        </span>
      )}

      {group.items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

        const linkContent = (
          <Link
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70",
              collapsed && "justify-center px-2"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground"
                )}
              />
            )}
            {!collapsed && <span className="truncate">{item.title}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger className="w-full">
                {linkContent}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.title}
              </TooltipContent>
            </Tooltip>
          );
        }

        return <div key={item.href}>{linkContent}</div>;
      })}
    </div>
  );
}
