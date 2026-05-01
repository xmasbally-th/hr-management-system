import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth callback route.
 *
 * After the user authenticates with Google, Supabase redirects them
 * here with an authorization `code`. This handler:
 *
 * 1. Exchanges the code for a session (sets auth cookies)
 * 2. Checks whether a `profiles` row exists for the user
 * 3. If not → creates one with default role='employee', status='pending'
 * 4. Redirects to /dashboard
 *
 * If anything fails it redirects to /login with an error param.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();

  // 1. Exchange auth code for session
  const { data: sessionData, error: sessionError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (sessionError || !sessionData.user) {
    console.error("[auth/callback] Session exchange failed:", sessionError);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const user = sessionData.user;

  // 2. Check if profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  // 3. Auto-create profile for first-time login
  if (!existingProfile) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "New User";

    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: fullName,
      role: "employee",    // default role for new users
      status: "pending",   // pending until admin activates
    });

    if (insertError) {
      console.error("[auth/callback] Profile creation failed:", insertError);
      // Don't block the user — they can still access the dashboard.
      // Admin can create/fix the profile later.
    }
  }

  // 4. Redirect to dashboard (or wherever `next` points)
  return NextResponse.redirect(`${origin}${next}`);
}
