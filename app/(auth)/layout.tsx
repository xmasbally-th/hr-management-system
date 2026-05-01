/**
 * Auth layout — minimal wrapper for login/register pages.
 * No sidebar or navbar. Centered content with subtle background.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      {children}
    </div>
  );
}
