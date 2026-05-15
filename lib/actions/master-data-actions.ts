"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";

async function checkHrAdminRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

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

function validateName(name: string, label: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0 || trimmed.length > 200) {
    throw new Error(`${label}ต้องมี 1–200 ตัวอักษร`);
  }
  return trimmed;
}

// =============================================================================
// Departments
// =============================================================================

export async function getDepartments() {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลหน่วยงานได้");
  return data;
}

export async function createDepartment(name: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อหน่วยงาน");

  const { data, error } = await supabase
    .from("departments")
    .insert({ name: clean })
    .select()
    .single();

  if (error) throw new Error("เพิ่มหน่วยงานไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, actorId, "create_department", "department", data.id, { name: clean });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updateDepartment(id: string, name: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อหน่วยงาน");

  const { error } = await supabase
    .from("departments")
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error("แก้ไขหน่วยงานไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, actorId, "update_department", "department", id, { name: clean });
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteDepartment(id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);

  // FK protection — refuse delete if any profile/position still references this dept
  const [{ count: profileCount }, { count: posCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("department_id", id),
    supabase.from("positions").select("id", { count: "exact", head: true }).eq("department_id", id),
  ]);

  if ((profileCount ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ — มีพนักงาน ${profileCount} คนสังกัดหน่วยงานนี้`);
  }
  if ((posCount ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ — มีตำแหน่ง ${posCount} ตำแหน่งสังกัดหน่วยงานนี้`);
  }

  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error("ลบหน่วยงานไม่สำเร็จ");
  await logAudit(supabase, actorId, "delete_department", "department", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

export async function countEmployeesByDepartment(id: string): Promise<number> {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("department_id", id);
  return count ?? 0;
}

// =============================================================================
// Positions
// =============================================================================

export async function getPositions() {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const { data, error } = await supabase
    .from("positions")
    .select("*, department:departments(name)")
    .order("name");

  if (error) throw new Error("ไม่สามารถดึงข้อมูลตำแหน่งได้");
  return data;
}

export async function createPosition(name: string, department_id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อตำแหน่ง");
  if (!department_id) throw new Error("กรุณาเลือกหน่วยงาน");

  const { data, error } = await supabase
    .from("positions")
    .insert({ name: clean, department_id })
    .select()
    .single();

  if (error) throw new Error("เพิ่มตำแหน่งไม่สำเร็จ");
  await logAudit(supabase, actorId, "create_position", "position", data.id, {
    name: clean,
    department_id,
  });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updatePosition(
  id: string,
  name: string,
  department_id: string,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อตำแหน่ง");
  if (!department_id) throw new Error("กรุณาเลือกหน่วยงาน");

  const { error } = await supabase
    .from("positions")
    .update({ name: clean, department_id })
    .eq("id", id);

  if (error) throw new Error("แก้ไขตำแหน่งไม่สำเร็จ");
  await logAudit(supabase, actorId, "update_position", "position", id, {
    name: clean,
    department_id,
  });
  revalidatePath("/dashboard/hr/master-data");
}

export async function deletePosition(id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);

  // FK protection — positions may be referenced by profiles
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("position_id", id);
  if ((count ?? 0) > 0) {
    throw new Error(`ลบไม่ได้ — มีพนักงาน ${count} คนใช้ตำแหน่งนี้`);
  }

  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error) throw new Error("ลบตำแหน่งไม่สำเร็จ");
  await logAudit(supabase, actorId, "delete_position", "position", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

export async function countEmployeesByPosition(id: string): Promise<number> {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("position_id", id);
  return count ?? 0;
}
