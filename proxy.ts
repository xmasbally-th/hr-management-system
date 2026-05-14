import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/supabase";

const PUBLIC_ROUTES = ["/login", "/auth/callback"];
const HR_ADMIN_ROUTES = ["/dashboard/hr", "/dashboard/settings"];
const MANAGER_PLUS_ROUTES = ["/dashboard/reports"];
const MANAGER_ROUTES = ["/dashboard/approvals"];

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

  // Not authenticated → redirect to login
  if (!user && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user on /login → redirect to dashboard
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // RBAC route protection for dashboard routes
  if (user && pathname.startsWith("/dashboard")) {
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

    // Rejected accounts
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

    // Manager+ routes (reports, approvals)
    if ([...MANAGER_ROUTES, ...MANAGER_PLUS_ROUTES].some((route) => pathname.startsWith(route))) {
      if (profile.role !== "manager" && profile.role !== "hr" && profile.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
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
