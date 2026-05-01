import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | HR Management",
  },
  description: "HR Management System Dashboard",
};

/**
 * Dashboard route-group layout.
 *
 * All pages under /dashboard/* share this layout which provides
 * the Navbar, Sidebar, and content-area shell. Auth guard is
 * handled inside DashboardShell (client-side redirect).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
