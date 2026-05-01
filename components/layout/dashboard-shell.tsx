"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/layout/navbar";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/supabase";

interface DashboardShellProps {
  children: React.ReactNode;
}

/**
 * Main dashboard shell — orchestrates Navbar, Sidebar (desktop + mobile),
 * and content area. Fetches the current user's profile and passes role
 * down to navigation components.
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch user profile on mount
  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    }

    loadProfile();
  }, [router]);

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }, [router]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleMobileMenuClick = useCallback(() => {
    setMobileOpen(true);
  }, []);

  return (
    <TooltipProvider delay={0}>
      <div className="relative min-h-screen bg-background">
        {/* Top navigation */}
        <Navbar
          profile={profile}
          onMenuClick={handleMobileMenuClick}
          onSignOut={handleSignOut}
        />

        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar
            role={profile?.role ?? "employee"}
            collapsed={sidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
          />
        </div>

        {/* Mobile sidebar — sheet overlay */}
        <MobileSidebar
          role={profile?.role ?? "employee"}
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        />

        {/* Main content area */}
        <main
          className={cn(
            "min-h-[calc(100vh-4rem)] pt-16 transition-all duration-300 ease-in-out",
            "lg:pl-[260px]",
            sidebarCollapsed && "lg:pl-[68px]"
          )}
        >
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
