"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { ProfileStatus, UserRole } from "@/types/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { env } from "@/lib/env";

/**
 * Validates that the current authenticated user has 'hr' or 'admin' role.
 * Throws an error if not authorized.
 */
async function checkHrAdminRole(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized: Please log in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user.id;
}

/**
 * Retrieves all user profiles, joined with department name.
 * Only accessible by 'admin' and 'hr'.
 */
export async function getProfiles() {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      *,
      department:departments(name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[user-actions] Failed to fetch profiles:", error);
    throw new Error("Failed to fetch profiles");
  }

  return data;
}

/**
 * Updates a user's status.
 * Only accessible by 'admin' and 'hr'.
 */
export async function updateUserStatus(userId: string, status: ProfileStatus) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user status:", error);
    throw new Error("Failed to update status");
  }

  await logAudit(supabase, actorId, "update_status", "profile", userId, { status });
  revalidatePath("/dashboard/hr/users");
}

/**
 * Updates a user's role.
 * Only accessible by 'admin' and 'hr'.
 */
export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user role:", error);
    throw new Error("Failed to update role");
  }

  await logAudit(supabase, actorId, "update_role", "profile", userId, { role });

  revalidatePath("/dashboard/hr/users");
}

/**
 * Creates a new user account + profile by Admin/HR.
 * Bypasses normal sign-up using the service role key.
 */
export async function createUserByAdmin(data: {
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  positionId: string | null;
}) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const supabaseAdmin = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // 1. Create auth user with random password (user will reset it or use SSO later)
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: data.fullName,
    },
  });

  if (authError) {
    console.error("[user-actions] Failed to create auth user:", authError);
    // Handle specific errors like email already exists
    if (authError.message.includes("already registered") || authError.status === 422) {
      throw new Error("อีเมลนี้มีอยู่ในระบบแล้ว (Email already registered)");
    }
    throw new Error("ไม่สามารถสร้างบัญชีผู้ใช้งานได้");
  }

  if (!authData.user) {
    throw new Error("Failed to create auth user (No user returned)");
  }

  // 2. Insert into profiles with 'approved' status
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    email: data.email,
    full_name: data.fullName,
    role: data.role,
    status: "approved",
    department_id: data.departmentId,
    position_id: data.positionId,
  });

  if (profileError) {
    console.error("[user-actions] Failed to create profile, rolling back:", profileError);
    // Try to rollback the auth user creation since profile failed
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new Error("บันทึกข้อมูลพนักงานไม่สำเร็จ กรุณาลองใหม่");
  }

  await logAudit(supabase, actorId, "create_user", "profile", authData.user.id, { email: data.email, role: data.role });
  revalidatePath("/dashboard/hr/users");

  return { success: true };
}
