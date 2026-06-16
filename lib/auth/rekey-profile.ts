import { type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Re-key a placeholder profile so it belongs to a real auth user.
 *
 * HR bulk-imports employees as **placeholder profiles** with a random
 * `id = gen_random_uuid()` and no `auth.users` row. When the employee first
 * authenticates (Google SSO, or HR provisioning a password), an auth user is
 * created with `auth.user.id = newId`. We then:
 *   1. Update child tables' FK columns from oldId → newId
 *   2. Update profiles.id from oldId → newId
 *
 * Children are updated FIRST — flipping the profiles PK while children still
 * reference oldId would violate the FK constraint.
 *
 * Service-role client only — RLS is bypassed (this runs before/around a user
 * session and must touch rows the user can't yet see).
 */
export async function rekeyPlaceholderProfile(
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
    `[rekey-profile] Re-keyed placeholder ${oldId} → ${newId} (${email})`,
  );
}
