import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * Dashboard home page — placeholder for Step 3.
 * Will be replaced with actual dashboard widgets in a future step.
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the HR Management System
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Employees", value: "—", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
          { label: "Pending Leaves", value: "—", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
          { label: "Travel Requests", value: "—", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
          { label: "Active Trainings", value: "—", color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Placeholder content area */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Dashboard content will be populated in upcoming steps. This
          layout provides the structural foundation with responsive
          Navbar, collapsible Sidebar, and RBAC-filtered navigation.
        </p>
      </div>
    </div>
  );
}
