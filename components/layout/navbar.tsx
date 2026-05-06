"use client";

import { useState } from "react";
import { Menu, LogOut, User, Settings, Search, ChevronDown } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/types/supabase";

interface NavbarProps {
  profile: Profile | null;
  onMenuClick: () => void;
  onSignOut: () => void;
}

export function Navbar({ profile, onMenuClick, onSignOut }: NavbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const roleLabel: Record<string, string> = {
    admin: "ผู้ดูแลระบบ",
    hr: "เจ้าหน้าที่ฝ่ายบุคคล",
    manager: "ผู้จัดการ",
    employee: "พนักงาน",
  };

  return (
    <header className="sticky top-0 z-30 bg-background border-b border-border">
      <div className="h-16 px-4 sm:px-6 flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-lg text-foreground/70 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-xl relative">
          <div
            className={cn(
              "flex items-center gap-2 h-10 px-3 rounded-lg border bg-muted/50 transition-all",
              searchFocused ? "border-primary bg-background ring-4 ring-primary/10" : "border-border"
            )}
          >
            <Search className="size-[17px] text-muted-foreground shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="ค้นหาพนักงาน คำขอ หรือเอกสาร..."
              className="flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="hidden md:inline-flex items-center px-1.5 h-5 rounded border border-border bg-background text-[10px] text-muted-foreground font-mono">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex-1 lg:flex-none"></div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-border mx-1"></div>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 sm:pl-1 sm:pr-2 py-1 rounded-lg hover:bg-muted focus:outline-none">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 grid place-items-center text-white text-[13px] font-semibold shadow-sm">
                {initials}
              </div>
              <div className="hidden sm:flex flex-col items-start min-w-0">
                <div className="text-[13px] font-semibold text-foreground leading-tight truncate max-w-[140px]">
                  {profile?.full_name ?? "Loading…"}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-px rounded">
                    {profile?.role ? roleLabel[profile.role] : "—"}
                  </span>
                </div>
              </div>
              <ChevronDown className="hidden sm:block size-[15px] text-muted-foreground transition-transform data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 rounded-xl p-0 overflow-hidden shadow-lg border border-border animate-fade-in">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 grid place-items-center text-white text-[14px] font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-foreground truncate">
                      {profile?.full_name ?? "Loading…"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {profile?.email ?? "—"}
                    </div>
                  </div>
                </div>
                {profile?.role && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                    {roleLabel[profile.role]}
                  </div>
                )}
              </div>
              
              <div className="py-1.5">
                <DropdownMenuItem
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] cursor-pointer"
                  onClick={() => { window.location.href = "/dashboard/profile"; }}
                >
                  <User className="size-4 text-muted-foreground" />
                  <span>โปรไฟล์ของฉัน</span>
                </DropdownMenuItem>
                
                <DropdownMenuItem
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] cursor-pointer"
                  onClick={() => { window.location.href = "/dashboard/settings"; }}
                >
                  <Settings className="size-4 text-muted-foreground" />
                  <span>ตั้งค่าบัญชี</span>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="m-0" />

              <div className="py-1.5">
                <DropdownMenuItem
                  onClick={onSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <span>ออกจากระบบ</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
