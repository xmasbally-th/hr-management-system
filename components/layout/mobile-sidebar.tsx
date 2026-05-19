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
  FileCheck2,
  MapPin,
  Building,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavigationForRole, type NavGroup } from "@/lib/navigation";
import type { UserRole } from "@/types/supabase";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

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
  FileCheck2,
  MapPin,
  Building,
  BarChart3,
  Settings,
};

interface MobileSidebarProps {
  role: UserRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({
  role,
  open,
  onOpenChange,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const groups = getNavigationForRole(role);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b border-sidebar-border px-4 py-4">
          <SheetTitle className="flex items-center gap-2 text-left">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">
                HR
              </span>
            </div>
            <span className="font-semibold">HR System</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-73px)]">
          <nav className="flex flex-col gap-1 p-3">
            {groups.map((group, groupIdx) => (
              <MobileNavGroup
                key={group.label}
                group={group}
                pathname={pathname}
                isFirst={groupIdx === 0}
                onNavigate={() => onOpenChange(false)}
              />
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavGroup({
  group,
  pathname,
  isFirst,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  isFirst: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {!isFirst && <Separator className="my-2" />}

      <span className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {group.label}
      </span>

      {group.items.map((item) => {
        const Icon = iconMap[item.icon];
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "active:scale-[0.98]",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/50"
                )}
              />
            )}
            <span>{item.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
