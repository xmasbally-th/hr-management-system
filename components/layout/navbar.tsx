"use client";

import Link from "next/link";
import { Menu, Bell, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const roleLabel: Record<string, string> = {
    admin: "Administrator",
    hr: "HR Officer",
    manager: "Manager",
    employee: "Employee",
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex w-full items-center gap-4 px-4">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu className="size-5" />
        </Button>

        {/* Logo / brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">
              HR
            </span>
          </div>
          <span className="hidden text-lg font-semibold tracking-tight sm:inline-block">
            HR Management
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Notifications */}
        <Link
          href="/dashboard/notifications"
          aria-label="Notifications"
          className="relative inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-muted"
        >
          <Bell className="size-[18px]" />
          {/* Unread indicator — controlled by real data in future */}
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="relative flex h-9 items-center gap-2 rounded-full pl-1.5 pr-3 text-sm font-medium transition-colors hover:bg-muted focus:outline-none">
            <Avatar className="size-7">
              <AvatarImage
                src={profile?.avatar_url ?? undefined}
                alt={profile?.full_name ?? "User"}
              />
              <AvatarFallback className="text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline-block">
              {profile?.full_name ?? "Loading…"}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
              <span className="text-sm font-medium">
                {profile?.full_name ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                {profile?.email ?? "—"}
              </span>
              {profile?.role && (
                <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
                  {roleLabel[profile.role] ?? profile.role}
                </Badge>
              )}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                window.location.href = "/dashboard/profile";
              }}
            >
              <User className="mr-2 size-4" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                window.location.href = "/dashboard/settings";
              }}
            >
              <Settings className="mr-2 size-4" />
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
