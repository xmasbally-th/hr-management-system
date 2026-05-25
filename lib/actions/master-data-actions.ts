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

// =============================================================================
// Catalogs — employee_types / education_levels / decoration_catalog
// =============================================================================

/**
 * Any authenticated user may read catalogs (used by profile editor dropdowns
 * and decoration autocomplete). RLS still enforces this server-side.
 */
async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ─── employee_types ─────────────────────────────────────────────────────

export async function getEmployeeTypes() {
  const supabase = await createClient();
  await getAuthUser(supabase);
  const { data, error } = await supabase
    .from("employee_types")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error("ไม่สามารถดึงข้อมูลประเภทบุคลากรได้");
  return data;
}

export async function createEmployeeType(
  name: string,
  sort_order = 0,
  vacation_accumulation_cap = 0,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อประเภทบุคลากร");
  const cap = Math.max(0, Math.floor(vacation_accumulation_cap));

  const { data, error } = await supabase
    .from("employee_types")
    .insert({ name: clean, sort_order, vacation_accumulation_cap: cap })
    .select()
    .single();
  if (error) throw new Error("เพิ่มประเภทบุคลากรไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, actorId, "create_employee_type", "employee_type", data.id, {
    name: clean, vacation_accumulation_cap: cap,
  });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updateEmployeeType(
  id: string,
  name: string,
  sort_order?: number,
  vacation_accumulation_cap?: number,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อประเภทบุคลากร");

  const update: { name: string; sort_order?: number; vacation_accumulation_cap?: number } = { name: clean };
  if (typeof sort_order === "number") update.sort_order = sort_order;
  if (typeof vacation_accumulation_cap === "number") {
    update.vacation_accumulation_cap = Math.max(0, Math.floor(vacation_accumulation_cap));
  }

  const { error } = await supabase.from("employee_types").update(update).eq("id", id);
  if (error) throw new Error("แก้ไขประเภทบุคลากรไม่สำเร็จ");
  await logAudit(supabase, actorId, "update_employee_type", "employee_type", id, update);
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteEmployeeType(id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);

  // FK protection — profiles.employee_type is a TEXT column (not FK), so
  // we string-match by name to detect "in use" before deleting.
  const { data: catalogRow } = await supabase
    .from("employee_types")
    .select("name")
    .eq("id", id)
    .single();
  if (catalogRow?.name) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("employee_type", catalogRow.name);
    if ((count ?? 0) > 0) {
      throw new Error(`ลบไม่ได้ — มีพนักงาน ${count} คนใช้ประเภทนี้`);
    }
  }

  const { error } = await supabase.from("employee_types").delete().eq("id", id);
  if (error) throw new Error("ลบประเภทบุคลากรไม่สำเร็จ");
  await logAudit(supabase, actorId, "delete_employee_type", "employee_type", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

// ─── education_levels ───────────────────────────────────────────────────

export async function getEducationLevels() {
  const supabase = await createClient();
  await getAuthUser(supabase);
  const { data, error } = await supabase
    .from("education_levels")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error("ไม่สามารถดึงข้อมูลวุฒิการศึกษาได้");
  return data;
}

export async function createEducationLevel(name: string, sort_order = 0) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อวุฒิการศึกษา");

  const { data, error } = await supabase
    .from("education_levels")
    .insert({ name: clean, sort_order })
    .select()
    .single();
  if (error) throw new Error("เพิ่มวุฒิการศึกษาไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, actorId, "create_education_level", "education_level", data.id, {
    name: clean,
  });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updateEducationLevel(
  id: string,
  name: string,
  sort_order?: number,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(name, "ชื่อวุฒิการศึกษา");

  const update: { name: string; sort_order?: number } = { name: clean };
  if (typeof sort_order === "number") update.sort_order = sort_order;

  const { error } = await supabase.from("education_levels").update(update).eq("id", id);
  if (error) throw new Error("แก้ไขวุฒิการศึกษาไม่สำเร็จ");
  await logAudit(supabase, actorId, "update_education_level", "education_level", id, update);
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteEducationLevel(id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);

  const { data: catalogRow } = await supabase
    .from("education_levels")
    .select("name")
    .eq("id", id)
    .single();
  if (catalogRow?.name) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("education_level", catalogRow.name);
    if ((count ?? 0) > 0) {
      throw new Error(`ลบไม่ได้ — มีพนักงาน ${count} คนใช้วุฒินี้`);
    }
  }

  const { error } = await supabase.from("education_levels").delete().eq("id", id);
  if (error) throw new Error("ลบวุฒิการศึกษาไม่สำเร็จ");
  await logAudit(supabase, actorId, "delete_education_level", "education_level", id, {});
  revalidatePath("/dashboard/hr/master-data");
}

// ─── decoration_catalog ─────────────────────────────────────────────────

export interface DecorationCatalogInput {
  name: string;
  abbreviation?: string | null;
  sort_order?: number;
}

export async function getDecorationCatalog() {
  const supabase = await createClient();
  await getAuthUser(supabase);
  const { data, error } = await supabase
    .from("decoration_catalog")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error("ไม่สามารถดึงข้อมูลเครื่องราชอิสริยาภรณ์ได้");
  return data;
}

export async function createDecorationCatalog(input: DecorationCatalogInput) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(input.name, "ชื่อเครื่องราชอิสริยาภรณ์");

  const { data, error } = await supabase
    .from("decoration_catalog")
    .insert({
      name: clean,
      abbreviation: input.abbreviation?.trim() || null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error("เพิ่มไม่สำเร็จ — อาจมีชื่อนี้อยู่แล้ว");
  await logAudit(supabase, actorId, "create_decoration_catalog", "decoration_catalog", data.id, {
    name: clean,
  });
  revalidatePath("/dashboard/hr/master-data");
  return data;
}

export async function updateDecorationCatalog(
  id: string,
  input: DecorationCatalogInput,
) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  const clean = validateName(input.name, "ชื่อเครื่องราชอิสริยาภรณ์");

  const update: {
    name: string;
    abbreviation: string | null;
    sort_order?: number;
  } = {
    name: clean,
    abbreviation: input.abbreviation?.trim() || null,
  };
  if (typeof input.sort_order === "number") update.sort_order = input.sort_order;

  const { error } = await supabase.from("decoration_catalog").update(update).eq("id", id);
  if (error) throw new Error("แก้ไขไม่สำเร็จ");
  await logAudit(supabase, actorId, "update_decoration_catalog", "decoration_catalog", id, {
    name: clean,
  });
  revalidatePath("/dashboard/hr/master-data");
}

export async function deleteDecorationCatalog(id: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);

  // Soft FK — profile_decorations.decoration_name is TEXT. Warn if used.
  const { data: catalogRow } = await supabase
    .from("decoration_catalog")
    .select("name")
    .eq("id", id)
    .single();
  if (catalogRow?.name) {
    const { count } = await supabase
      .from("profile_decorations")
      .select("id", { count: "exact", head: true })
      .eq("decoration_name", catalogRow.name);
    if ((count ?? 0) > 0) {
      throw new Error(`ลบไม่ได้ — มีพนักงาน ${count} คนมีเครื่องราชนี้ในประวัติ`);
    }
  }

  const { error } = await supabase.from("decoration_catalog").delete().eq("id", id);
  if (error) throw new Error("ลบเครื่องราชอิสริยาภรณ์ไม่สำเร็จ");
  await logAudit(supabase, actorId, "delete_decoration_catalog", "decoration_catalog", id, {});
  revalidatePath("/dashboard/hr/master-data");
}
