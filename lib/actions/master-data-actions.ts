"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function checkHrAdminRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) {
    throw new Error("Forbidden: Insufficient permissions");
  }
}

export async function getDepartments() {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) throw new Error("Failed to fetch departments");
  return data;
}

export async function getPositions() {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { data, error } = await supabase
    .from("positions")
    .select("*, department:departments(name)")
    .order("name");

  if (error) throw new Error("Failed to fetch positions");
  return data;
}

export async function createDepartment(name: string) {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("departments")
    .insert({ name });

  if (error) throw new Error("Failed to create department");
  revalidatePath("/dashboard/hr/master-data");
}

export async function createPosition(name: string, department_id: string) {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("positions")
    .insert({ name, department_id });

  if (error) throw new Error("Failed to create position");
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id);

  if (error) throw new Error("Failed to delete department (might be in use)");
  revalidatePath("/dashboard/hr/master-data");
}

export async function deletePosition(id: string) {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", id);

  if (error) throw new Error("Failed to delete position");
  revalidatePath("/dashboard/hr/master-data");
}
