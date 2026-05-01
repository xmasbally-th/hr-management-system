import { redirect } from "next/navigation";

/**
 * Root page — immediately redirects to /dashboard.
 * Auth check is handled by the proxy (middleware) and DashboardShell.
 */
export default function HomePage() {
  redirect("/dashboard");
}
