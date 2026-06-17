import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const HR_ADMIN_ROUTES = ["/dashboard/hr", "/dashboard/settings"];
const MANAGER_PLUS_ROUTES = ["/dashboard/reports"];
const MANAGER_ROUTES = ["/dashboard/approvals"];

// Statuses that block dashboard access — user must go through /welcome.
// Note: awaiting_correction is NOT in this set — users who submit a
// correction request are immediately approved and can use the system
// while HR processes their changes. A banner in the dashboard layout
// surfaces the pending request.
const ONBOARDING_STATUSES = new Set([
  "pre_registered",
  "awaiting_confirmation",
  "pending", // legacy — treat same as awaiting_confirmation for safety
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboard = pathname.startsWith("/dashboard");
  const isWelcome = pathname.startsWith("/welcome");
  const needsAuth = isDashboard || isWelcome;

  // Not authenticated → redirect to login
  if (!user && needsAuth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on /login → kick to dashboard (status-routing below
  // will then send them to /welcome if onboarding still pending)
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Status-aware routing + RBAC for protected pages
  if (user && needsAuth) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "no_profile");
      return NextResponse.redirect(loginUrl);
    }

    // Rejected accounts — always bounce to login
    if (profile.status === "rejected") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "account_rejected");
      return NextResponse.redirect(loginUrl);
    }

    // Onboarding gate — users mid-onboarding belong at /welcome only
    const onboarding = ONBOARDING_STATUSES.has(profile.status);

    if (onboarding && isDashboard) {
      return NextResponse.redirect(new URL("/welcome", request.url));
    }

    // Approved user accidentally on /welcome → send to dashboard
    if (!onboarding && isWelcome) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // RBAC only applies to /dashboard/* routes (after onboarding clears)
    if (isDashboard) {
      // HR/Admin-only routes
      if (HR_ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
        // Exceptions: pages under /dashboard/hr that manager may read — the
        // unified leave and travel hubs (manager sees read-only/queue tabs
        // there). /dashboard/hr/documents kept so old bookmarks still redirect.
        const managerAllowed =
          profile.role === "manager" &&
          (pathname.startsWith("/dashboard/hr/documents") ||
            pathname.startsWith("/dashboard/hr/leaves") ||
            pathname.startsWith("/dashboard/hr/travel"));
        if (!managerAllowed && profile.role !== "hr" && profile.role !== "admin") {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }

      // Manager+ routes (reports, approvals)
      if (
        [...MANAGER_ROUTES, ...MANAGER_PLUS_ROUTES].some((route) =>
          pathname.startsWith(route),
        )
      ) {
        if (
          profile.role !== "manager" &&
          profile.role !== "hr" &&
          profile.role !== "admin"
        ) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
