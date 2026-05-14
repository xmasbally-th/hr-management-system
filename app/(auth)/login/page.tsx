import { Suspense } from "react";
import { LoginClient } from "./login-client";

/**
 * Login route — server component wrapper.
 *
 * The actual UI lives in LoginClient (uses `useSearchParams`).
 * Wrapping in <Suspense> is required so Next.js can stream the page
 * shell without bailing out of static prerender.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <LoginClient />
    </Suspense>
  );
}
