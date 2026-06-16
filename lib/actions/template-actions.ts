"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { logAudit } from "@/lib/audit-log";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Database } from "@/types/supabase";

const TEMPLATE_BUCKET = "templates";
const MAX_TEMPLATE_SIZE = 5 * 1024 * 1024; // 5 MB
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LEAVE_CODES = ["SICK", "PERSONAL", "VACATION", "MATERNITY"];

function adminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Require the caller to be an Admin (template management is Admin-only). */
async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  checkRateLimit(user.id);
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only (จัดการเทมเพลตได้เฉพาะผู้ดูแลระบบ)");
  }
  return user.id;
}

export interface LeaveTemplate {
  id: string;
  leave_type_code: string | null;
  name: string;
  storage_path: string;
  is_active: boolean;
  created_at: string;
}

/** List all leave .docx templates (any authenticated user can read metadata). */
export async function getLeaveTemplates(): Promise<LeaveTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("document_templates")
    .select("id, leave_type_code, name, storage_path, is_active, created_at")
    .eq("doc_type", "leave")
    .order("leave_type_code", { nullsFirst: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error("ไม่สามารถดึงรายการเทมเพลตได้");
  return data ?? [];
}

/** List travel-order .docx templates (any authenticated user can read metadata). */
export async function getTravelTemplates(): Promise<LeaveTemplate[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("document_templates")
    .select("id, leave_type_code, name, storage_path, is_active, created_at")
    .eq("doc_type", "travel")
    .order("created_at", { ascending: false });
  if (error) throw new Error("ไม่สามารถดึงรายการเทมเพลตได้");
  return data ?? [];
}

/**
 * Upload a .docx travel-order template (Admin only). A single active template
 * is used for all travel types; uploading a new one deactivates the previous.
 */
export async function uploadTravelTemplate(formData: FormData): Promise<{ id: string }> {
  const actorId = await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์ .docx");
  if (file.size > MAX_TEMPLATE_SIZE) throw new Error("ไฟล์เกิน 5 MB");
  const isDocx = file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) throw new Error("รองรับเฉพาะไฟล์ Word (.docx)");

  const admin = adminClient();
  const storagePath = `travel/order-${Date.now()}.docx`;

  const { error: upErr } = await admin.storage
    .from(TEMPLATE_BUCKET)
    .upload(storagePath, file, { contentType: DOCX_MIME, upsert: false });
  if (upErr) {
    console.error("[template-actions] travel upload failed:", upErr.message);
    throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
  }

  await admin
    .from("document_templates")
    .update({ is_active: false })
    .eq("doc_type", "travel")
    .eq("is_active", true);

  const { data: created, error: insErr } = await admin
    .from("document_templates")
    .insert({
      doc_type: "travel",
      leave_type_code: null,
      name: file.name,
      storage_path: storagePath,
      is_active: true,
      uploaded_by: actorId,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    await admin.storage.from(TEMPLATE_BUCKET).remove([storagePath]);
    throw new Error("บันทึกเทมเพลตไม่สำเร็จ");
  }

  const supabase = await createClient();
  await logAudit(supabase, actorId, "upload_travel_template", "document_template", created.id, {
    name: file.name,
  });
  revalidatePath("/dashboard/hr/master-data");
  return { id: created.id };
}

/**
 * Upload a .docx leave template (Admin only). Deactivates any previously
 * active template for the same leave_type_code so only one is active.
 *
 * formData: `file` (.docx), `leaveTypeCode` ('' / SICK / PERSONAL / VACATION /
 * MATERNITY — empty = general fallback).
 */
export async function uploadLeaveTemplate(formData: FormData): Promise<{ id: string }> {
  const actorId = await requireAdmin();

  const file = formData.get("file") as File | null;
  const rawCode = (formData.get("leaveTypeCode") as string | null)?.trim() || null;
  const leaveTypeCode = rawCode && LEAVE_CODES.includes(rawCode) ? rawCode : null;

  if (!file || file.size === 0) throw new Error("กรุณาเลือกไฟล์ .docx");
  if (file.size > MAX_TEMPLATE_SIZE) throw new Error("ไฟล์เกิน 5 MB");
  const isDocx =
    file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) throw new Error("รองรับเฉพาะไฟล์ Word (.docx)");

  const admin = adminClient();
  const ts = Date.now();
  const storagePath = `leave/${leaveTypeCode ?? "general"}-${ts}.docx`;

  const { error: upErr } = await admin.storage
    .from(TEMPLATE_BUCKET)
    .upload(storagePath, file, { contentType: DOCX_MIME, upsert: false });
  if (upErr) {
    console.error("[template-actions] upload failed:", upErr.message);
    throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
  }

  // Deactivate existing active templates for the same (doc_type, code)
  let deact = admin
    .from("document_templates")
    .update({ is_active: false })
    .eq("doc_type", "leave")
    .eq("is_active", true);
  deact = leaveTypeCode === null
    ? deact.is("leave_type_code", null)
    : deact.eq("leave_type_code", leaveTypeCode);
  await deact;

  const { data: created, error: insErr } = await admin
    .from("document_templates")
    .insert({
      doc_type: "leave",
      leave_type_code: leaveTypeCode,
      name: file.name,
      storage_path: storagePath,
      is_active: true,
      uploaded_by: actorId,
    })
    .select("id")
    .single();
  if (insErr || !created) {
    // best-effort cleanup of the uploaded file
    await admin.storage.from(TEMPLATE_BUCKET).remove([storagePath]);
    throw new Error("บันทึกเทมเพลตไม่สำเร็จ");
  }

  const supabase = await createClient();
  await logAudit(supabase, actorId, "upload_leave_template", "document_template", created.id, {
    leave_type_code: leaveTypeCode, name: file.name,
  });
  revalidatePath("/dashboard/hr/master-data");
  return { id: created.id };
}

/** Activate/deactivate a template (Admin). Activating deactivates siblings. */
export async function setLeaveTemplateActive(id: string, active: boolean): Promise<void> {
  const actorId = await requireAdmin();
  const admin = adminClient();

  if (active) {
    const { data: tpl } = await admin
      .from("document_templates")
      .select("doc_type, leave_type_code")
      .eq("id", id)
      .single();
    if (tpl) {
      let deact = admin
        .from("document_templates")
        .update({ is_active: false })
        .eq("doc_type", tpl.doc_type)
        .eq("is_active", true)
        .neq("id", id);
      deact = tpl.leave_type_code === null
        ? deact.is("leave_type_code", null)
        : deact.eq("leave_type_code", tpl.leave_type_code);
      await deact;
    }
  }

  const { error } = await admin
    .from("document_templates")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error("ไม่สามารถเปลี่ยนสถานะเทมเพลตได้");

  const supabase = await createClient();
  await logAudit(supabase, actorId, "set_template_active", "document_template", id, { active });
  revalidatePath("/dashboard/hr/master-data");
}

/** Delete a template + its storage file (Admin). */
export async function deleteLeaveTemplate(id: string): Promise<void> {
  const actorId = await requireAdmin();
  const admin = adminClient();

  const { data: tpl } = await admin
    .from("document_templates").select("storage_path").eq("id", id).single();

  const { error } = await admin.from("document_templates").delete().eq("id", id);
  if (error) throw new Error("ลบเทมเพลตไม่สำเร็จ");

  if (tpl?.storage_path) {
    await admin.storage.from(TEMPLATE_BUCKET).remove([tpl.storage_path]);
  }

  const supabase = await createClient();
  await logAudit(supabase, actorId, "delete_leave_template", "document_template", id, {});
  revalidatePath("/dashboard/hr/master-data");
}
