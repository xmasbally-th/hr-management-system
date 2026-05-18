import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMyPendingCorrections } from "@/lib/actions/welcome-actions";
import { CorrectionStatusBanner } from "./_components/correction-status-banner";

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
 *
 * Also surfaces any pending profile-correction requests as a banner
 * so the user knows HR is processing their changes.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fire-and-forget — if this fails (e.g. table not migrated yet) we
  // simply don't show the banner instead of breaking every dashboard page.
  const corrections = await getMyPendingCorrections().catch(() => []);

  return (
    <DashboardShell>
      <CorrectionStatusBanner corrections={corrections} />
      {children}
    </DashboardShell>
  );
}
