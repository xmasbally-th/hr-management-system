"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ProfileStatus, UserRole } from "@/types/supabase";

/**
 * Validates that the current authenticated user has 'hr' or 'admin' role.
 * Throws an error if not authorized.
 */
async function checkHrAdminRole(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user status:", error);
    throw new Error("Failed to update status");
  }

  revalidatePath("/dashboard/hr/users");
}

/**
 * Updates a user's role.
 * Only accessible by 'admin' and 'hr'.
 */
export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user role:", error);
    throw new Error("Failed to update role");
  }

  revalidatePath("/dashboard/hr/users");
}
