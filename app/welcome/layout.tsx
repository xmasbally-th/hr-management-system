import type { Metadata } from "next";

export const metadata: Metadata = { title: "ยินดีต้อนรับ" };

/**
 * Minimal layout for the first-login welcome flow.
 *
 * Bypasses the dashboard shell (no sidebar/navbar) — just a centered
 * content area so the user cannot navigate away before completing
 * their profile.
 */
export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center shadow-lg shadow-indigo-900/20">
            <span className="text-white font-bold text-sm tracking-tight">HR</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">
              HR Hybrid Workflow
            </div>
            <div className="text-xs text-muted-foreground leading-tight">
              ตรวจสอบข้อมูลเริ่มต้น
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
