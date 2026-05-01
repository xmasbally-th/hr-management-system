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
 *
 * Auth flow:
 * 1. Get current user from Supabase
 * 2. If no user → redirect to /login
 * 3. Fetch profile from `profiles` table
 * 4. If no profile (edge case — callback should have created one) → create it
 * 5. Pass profile to Navbar/Sidebar for RBAC filtering
 */
export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch user profile on mount
  useEffect(() => {
    const supabase = createClient();

    async function loadProfile() {
      // 1. Check auth session
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // 2. Fetch existing profile
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (existingProfile) {
        setProfile(existingProfile);
        setIsLoading(false);
        return;
      }

      // 3. Edge case: profile doesn't exist yet (callback failed to create)
      //    Create a fallback profile client-side
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "New User";

      const avatarUrl =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;

      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          role: "employee" as const,
          status: "pending" as const,
          avatar_url: avatarUrl,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[dashboard-shell] Fallback profile creation failed:", insertError);
        // Still show a usable profile from auth metadata
        setProfile({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          role: "employee",
          status: "pending",
          department_id: null,
          avatar_url: avatarUrl,
          phone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else if (newProfile) {
        setProfile(newProfile);
      }

      setIsLoading(false);
    }

    loadProfile();
  }, [router]);

  // Listen for auth state changes (e.g. sign out from another tab)
  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <span className="text-lg font-bold text-primary-foreground">HR</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            กำลังโหลด...
          </div>
        </div>
      </div>
    );
  }

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
