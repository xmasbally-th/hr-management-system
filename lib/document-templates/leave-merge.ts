/**
 * Leave .docx mail-merge (W3b).
 *
 * Loads the active Admin-uploaded template for a leave type (falling back to
 * the general template), fills `{placeholder}` tags with the leave data via
 * docxtemplater, and returns a .docx buffer. Server-only (service-role).
 *
 * Placeholders available in templates (use `{name}` syntax):
 *   {title_th} {full_name} {position} {department}
 *   {leave_type} {start_date} {end_date} {total_days} {working_days}
 *   {reason} {contact} {edd}
 *   {accumulated_days} {annual_days} {substitute_1} {substitute_2}
 *   {substitute_3} {branch_head_opinion} {today_thai}
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatThai } from "@/lib/date-ranges";
import type { Database } from "@/types/supabase";

function admin(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function fmt(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return formatThai(d);
  } catch {
    return d;
  }
}

export async function generateLeaveDocx(
  leaveRequestId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const supa = admin();

  // 1. Leave + employee + type + vacation details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leave, error: lErr } = await supa
    .from("leave_requests")
    .select(
      `*,
       leave_type:leave_types(name, code),
       employee:profiles!leave_requests_employee_id_fkey(title_th, full_name, position_title, department:departments(name)),
       vacation:leave_vacation_details(*)`,
    )
    .eq("id", leaveRequestId)
    .single();
  if (lErr || !leave) throw new Error("ไม่พบใบลานี้");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = leave as any;
  const code: string | null = l.leave_type?.code ?? null;

  // 2. Pick template: specific code → fallback to general (null code)
  const pickTemplate = async (codeFilter: string | null) => {
    let q = supa
      .from("document_templates")
      .select("storage_path, name")
      .eq("doc_type", "leave")
      .eq("is_active", true);
    q = codeFilter === null ? q.is("leave_type_code", null) : q.eq("leave_type_code", codeFilter);
    const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data;
  };
  const tpl = (code ? await pickTemplate(code) : null) ?? (await pickTemplate(null));
  if (!tpl) {
    throw new Error("ยังไม่ได้อัปโหลดเทมเพลต .docx สำหรับประเภทลานี้ — กรุณาให้ผู้ดูแลระบบอัปโหลดก่อน");
  }

  // 3. Download template binary
  const { data: file, error: dErr } = await supa.storage.from("templates").download(tpl.storage_path);
  if (dErr || !file) throw new Error("โหลดไฟล์เทมเพลตไม่สำเร็จ");
  const arrayBuf = await file.arrayBuffer();

  // 4. Resolve vacation substitute names (if any)
  const vac = Array.isArray(l.vacation) ? l.vacation[0] : l.vacation;
  const subNames: Record<string, string> = { substitute_1: "", substitute_2: "", substitute_3: "" };
  if (vac) {
    const ids = [vac.substitute_1_id, vac.substitute_2_id, vac.substitute_3_id].filter(Boolean) as string[];
    if (ids.length) {
      const { data: profs } = await supa.from("profiles").select("id, full_name").in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      subNames.substitute_1 = vac.substitute_1_id ? byId.get(vac.substitute_1_id) ?? "" : "";
      subNames.substitute_2 = vac.substitute_2_id ? byId.get(vac.substitute_2_id) ?? "" : "";
      subNames.substitute_3 = vac.substitute_3_id ? byId.get(vac.substitute_3_id) ?? "" : "";
    }
  }

  // 5. Build merge data
  const data: Record<string, string | number> = {
    title_th: l.employee?.title_th ?? "",
    full_name: l.employee?.full_name ?? "",
    position: l.employee?.position_title ?? "",
    department: l.employee?.department?.name ?? "",
    leave_type: l.leave_type?.name ?? "",
    start_date: fmt(l.start_date),
    end_date: fmt(l.end_date),
    total_days: l.total_days ?? "",
    working_days: l.working_days ?? l.total_days ?? "",
    reason: l.reason ?? "",
    contact: l.contact_number ?? "",
    edd: fmt(l.expected_delivery_date),
    accumulated_days: vac?.accumulated_days ?? "",
    annual_days: vac?.annual_days ?? "",
    branch_head_opinion: vac?.branch_head_opinion ?? "",
    today_thai: fmt(new Date().toISOString().slice(0, 10)),
    ...subNames,
  };

  // 6. Merge
  let buffer: Buffer;
  try {
    const zip = new PizZip(Buffer.from(arrayBuf));
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.render(data);
    buffer = doc.getZip().generate({ type: "nodebuffer" });
  } catch (err) {
    console.error("[leave-merge] render failed:", err);
    throw new Error("สร้างเอกสารจากเทมเพลตไม่สำเร็จ — ตรวจสอบ placeholder ในเทมเพลต");
  }

  const safeName = (l.employee?.full_name ?? "leave").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
  return { buffer, filename: `ใบลา-${safeName}-${leaveRequestId.slice(0, 8)}.docx` };
}

/**
 * แบบใบขอยกเลิกวันลา (.docx) — fills the admin-uploaded template with
 * leave_type_code = 'CANCELLATION' using data from the cancellation request
 * plus its original leave. Extra placeholders: {cancel_reason}
 * {cancel_request_date}; the leave placeholders ({full_name}, {leave_type},
 * {start_date} …) refer to the original leave being cancelled.
 */
export async function generateLeaveCancellationDocx(
  cancellationId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const supa = admin();

  const { data: cancel, error: cErr } = await supa
    .from("leave_cancellation_requests")
    .select("id, leave_request_id, reason, created_at")
    .eq("id", cancellationId)
    .single();
  if (cErr || !cancel) throw new Error("ไม่พบคำขอยกเลิกนี้");

  const { data: leave, error: lErr } = await supa
    .from("leave_requests")
    .select(
      `*,
       leave_type:leave_types(name, code),
       employee:profiles!leave_requests_employee_id_fkey(title_th, full_name, position_title, department:departments(name))`,
    )
    .eq("id", cancel.leave_request_id)
    .single();
  if (lErr || !leave) throw new Error("ไม่พบใบลาต้นทาง");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = leave as any;

  const { data: tpl } = await supa
    .from("document_templates")
    .select("storage_path, name")
    .eq("doc_type", "leave")
    .eq("is_active", true)
    .eq("leave_type_code", "CANCELLATION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tpl) {
    throw new Error(
      "ยังไม่ได้อัปโหลดเทมเพลต \"ใบขอยกเลิกวันลา\" — อัปโหลดที่ ข้อมูลหลัก → เทมเพลตเอกสาร (ประเภท CANCELLATION)",
    );
  }

  const { data: file, error: dErr } = await supa.storage.from("templates").download(tpl.storage_path);
  if (dErr || !file) throw new Error("โหลดไฟล์เทมเพลตไม่สำเร็จ");

  const data: Record<string, string | number> = {
    title_th: l.employee?.title_th ?? "",
    full_name: l.employee?.full_name ?? "",
    position: l.employee?.position_title ?? "",
    department: l.employee?.department?.name ?? "",
    leave_type: l.leave_type?.name ?? "",
    start_date: fmt(l.start_date),
    end_date: fmt(l.end_date),
    total_days: l.total_days ?? "",
    working_days: l.working_days ?? l.total_days ?? "",
    cancel_reason: cancel.reason ?? "",
    cancel_request_date: fmt((cancel.created_at ?? "").slice(0, 10)),
    today_thai: fmt(new Date().toISOString().slice(0, 10)),
  };

  let buffer: Buffer;
  try {
    const zip = new PizZip(Buffer.from(await file.arrayBuffer()));
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
    });
    doc.render(data);
    buffer = doc.getZip().generate({ type: "nodebuffer" });
  } catch (err) {
    console.error("[leave-merge] cancellation render failed:", err);
    throw new Error("สร้างเอกสารจากเทมเพลตไม่สำเร็จ — ตรวจสอบ placeholder ในเทมเพลต");
  }

  const safeName = (l.employee?.full_name ?? "leave").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
  return { buffer, filename: `ใบขอยกเลิกวันลา-${safeName}-${cancellationId.slice(0, 8)}.docx` };
}
