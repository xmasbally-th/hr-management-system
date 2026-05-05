import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

// Routes that are accessible without authentication
const PUBLIC_ROUTES = ["/login", "/auth/callback"];

// Routes that require hr or admin role
const HR_ADMIN_ROUTES = [
  "/dashboard/hr",
  "/dashboard/reports",
  "/dashboard/settings",
];

// Routes that require manager, hr, or admin role
const MANAGER_ROUTES = ["/dashboard/approvals"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public routes and static files immediately
  if (
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Create a Supabase client that can read/write cookies for session refresh
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this is the primary purpose of the middleware
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Not authenticated → redirect to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user on /login → redirect to dashboard
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 3. Check profile status and role for protected routes
  if (pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();

    // No profile yet (OAuth callback still processing) → allow through
    if (!profile) return response;

    // Rejected accounts → redirect to login with message
    if (profile.status === "rejected") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "account_rejected");
      return NextResponse.redirect(loginUrl);
    }

    // HR/Admin-only routes
    if (HR_ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
      if (profile.role !== "hr" && profile.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    // Manager+ routes (manager, hr, admin)
    if (MANAGER_ROUTES.some((route) => pathname.startsWith(route))) {
      if (profile.role === "employee") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return response;
}

export const config = {
  // Match all routes except static files and API internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
