import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { isEmailAllowed } from "@/lib/system-settings";
import { env } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * OAuth callback route — Whitelist-First Onboarding (Phase P-Onboard).
 *
 * After Google OAuth redirects here with an authorization `code`:
 *
 * 1. Exchange code for session (sets auth cookies)
 * 2. Enforce email-domain allowlist
 * 3. Profile linking — whitelist-strict:
 *    a) profile already linked by auth.user.id → check status
 *       (rejected → signOut · ok → continue)
 *    b) placeholder profile exists with matching email (HR-imported, never
 *       logged in) → re-key the placeholder ID to auth.user.id, cascade
 *       FKs, set status='awaiting_confirmation' so /welcome gates them
 *    c) no profile (HR didn't pre-register this email) → signOut + redirect
 *       to /login?error=not_whitelisted. NEW USERS CANNOT SELF-REGISTER.
 * 4. Redirect to /dashboard (proxy routes to /welcome based on status)
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

  // 2. Enforce email-domain allowlist (reads from system_settings table —
  //    falls back to NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS env when missing)
  if (!(await isEmailAllowed(user.email))) {
    console.warn(
      "[auth/callback] Rejected sign-in from disallowed domain:",
      user.email,
    );
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // 3. Profile linking — service-role client bypasses RLS for the
  //    re-key + status update paths.
  const supabaseAdmin: SupabaseClient<Database> = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // 3a. Already linked by ID — returning user
  const { data: existingById } = await supabaseAdmin
    .from("profiles")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (existingById) {
    if (existingById.status === "rejected") {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/login?error=account_rejected`,
      );
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // 3b. Try email match — HR-imported placeholder waiting to be claimed
  const { data: placeholder } = await supabaseAdmin
    .from("profiles")
    .select("id, status")
    .ilike("email", user.email!)
    .is("profile_completed_at", null)
    .maybeSingle();

  if (!placeholder) {
    // 3c. Whitelist gate — no placeholder means HR didn't pre-register
    //     this email. Reject; do not auto-create.
    console.warn(
      "[auth/callback] Not whitelisted — no placeholder profile for:",
      user.email,
    );
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_whitelisted`);
  }

  if (placeholder.status === "rejected") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=account_rejected`);
  }

  // Re-key the placeholder → cascade FKs in all child tables
  try {
    await rekeyPlaceholderProfile(
      supabaseAdmin,
      placeholder.id,
      user.id,
      user.email!,
    );
  } catch (err) {
    console.error("[auth/callback] Re-key failed:", err);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=rekey_failed`);
  }

  // After re-key, gate user at /welcome until they confirm their profile.
  // Placeholders were created with profile_completed_at=NULL — we leave it
  // that way; status moves to 'awaiting_confirmation' so the proxy routes
  // them to /welcome.
  const { error: statusError } = await supabaseAdmin
    .from("profiles")
    .update({
      status: "awaiting_confirmation",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (statusError) {
    console.error(
      "[auth/callback] Failed to set awaiting_confirmation status:",
      statusError,
    );
    // Don't block — proxy still works off whatever status remains
  }

  // 4. Redirect to dashboard — proxy will route to /welcome based on status
  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * Re-key a placeholder profile so it belongs to a real auth user.
 *
 * The placeholder was created with `id = gen_random_uuid()` and the user
 * just signed in with `auth.user.id = newId`. We need to:
 *   1. Update child tables' FK columns from oldId → newId
 *   2. Update profiles.id from oldId → newId
 *
 * We update children FIRST (a profiles PK change while children still
 * reference oldId would violate the FK constraint).
 *
 * Service-role client only — RLS is bypassed.
 */
async function rekeyPlaceholderProfile(
  admin: SupabaseClient<Database>,
  oldId: string,
  newId: string,
  email: string,
): Promise<void> {
  // Tables with employee_id / approver_id / user_id / profile_id pointing at profiles
  const childUpdates: Array<{ table: string; column: string }> = [
    { table: "leave_balances", column: "employee_id" },
    { table: "leave_requests", column: "employee_id" },
    { table: "leave_requests", column: "approver_id" },
    { table: "leave_vacation_details", column: "substitute_1_id" },
    { table: "leave_vacation_details", column: "substitute_2_id" },
    { table: "leave_vacation_details", column: "substitute_3_id" },
    { table: "travel_requests", column: "employee_id" },
    { table: "travel_requests", column: "approver_id" },
    { table: "notifications", column: "user_id" },
    { table: "employee_trainings", column: "employee_id" },
    { table: "audit_logs", column: "user_id" },
    { table: "profile_educations", column: "profile_id" },
    { table: "profile_decorations", column: "profile_id" },
    { table: "profile_admin_positions", column: "profile_id" },
  ];

  for (const { table, column } of childUpdates) {
    // Cast admin to any — this helper is intentionally generic across many tables
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any)
      .from(table)
      .update({ [column]: newId })
      .eq(column, oldId);
    if (error) {
      // Some tables may not exist in older deployments — tolerate "relation does not exist"
      const msg = error.message ?? "";
      if (msg.includes("does not exist") || msg.includes("relation")) {
        continue;
      }
      throw new Error(`Re-key failed at ${table}.${column}: ${msg}`);
    }
  }

  // Now flip the profile's PK and refresh email/timestamps
  const { error: profileError } = await admin
    .from("profiles")
    .update({ id: newId, email, updated_at: new Date().toISOString() })
    .eq("id", oldId);

  if (profileError) {
    throw new Error(`Re-key failed at profiles: ${profileError.message}`);
  }

  console.info(
    `[auth/callback] Re-keyed placeholder ${oldId} → ${newId} (${email})`,
  );
}
