/**
 * Travel-order .docx mail-merge.
 *
 * Loads the active Admin-uploaded travel template (doc_type='travel'), fills
 * `{placeholder}` tags with the travel-request data via docxtemplater, and
 * returns a .docx buffer. Server-only (service-role).
 *
 * Throws `NO_TRAVEL_TEMPLATE` when no active template exists so the route can
 * fall back to the code-built order document.
 *
 * Placeholders available in templates (use `{name}` syntax):
 *   {full_name} {position} {department}
 *   {travel_type} {title} {location} {start_date} {end_date} {total_days}
 *   {estimated_budget} {actual_budget} {today_thai}
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { formatThai } from "@/lib/date-ranges";
import type { Database } from "@/types/supabase";

export const NO_TRAVEL_TEMPLATE = "NO_TRAVEL_TEMPLATE";

const TRAVEL_TYPE_LABELS: Record<string, string> = {
  training: "ไปราชการเพื่ออบรม/สัมมนา",
  supervision: "ไปราชการเพื่อนิเทศ",
  official_contact: "ไปราชการเพื่อติดต่อราชการ",
};

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
    return formatThai(d.slice(0, 10));
  } catch {
    return d;
  }
}

function baht(n: number): string {
  return n > 0 ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

export async function generateTravelDocx(
  travelRequestId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const supa = admin();

  // 1. Pick active travel template (single, all travel types share it)
  const { data: tpl } = await supa
    .from("document_templates")
    .select("storage_path, name")
    .eq("doc_type", "travel")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!tpl) throw new Error(NO_TRAVEL_TEMPLATE);

  // 2. Travel request + employee + expenses
  const { data: req, error: rErr } = await supa
    .from("travel_requests")
    .select(
      `*,
       employee:profiles!travel_requests_employee_id_fkey(full_name, position_title, position:positions(name), department:departments(name)),
       expenses:travel_expenses(estimated_amount, actual_amount)`,
    )
    .eq("id", travelRequestId)
    .single();
  if (rErr || !req) throw new Error("ไม่พบคำขอเดินทางนี้");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = req as any;
  const expenses: { estimated_amount: number | null; actual_amount: number | null }[] =
    Array.isArray(r.expenses) ? r.expenses : [];
  const estimated = expenses.reduce((s, e) => s + (Number(e.estimated_amount) || 0), 0);
  const actual = expenses.reduce((s, e) => s + (Number(e.actual_amount) || 0), 0);

  // 3. Download template binary
  const { data: file, error: dErr } = await supa.storage.from("templates").download(tpl.storage_path);
  if (dErr || !file) throw new Error("โหลดไฟล์เทมเพลตไม่สำเร็จ");

  // 4. Merge data
  const data: Record<string, string | number> = {
    full_name: r.employee?.full_name ?? "",
    position: r.employee?.position_title || r.employee?.position?.name || "",
    department: r.employee?.department?.name ?? "",
    travel_type: TRAVEL_TYPE_LABELS[r.travel_type] ?? r.travel_type ?? "",
    title: r.title ?? "",
    location: r.location ?? "",
    start_date: fmt(r.start_date),
    end_date: fmt(r.end_date),
    total_days: r.total_days ?? "",
    estimated_budget: baht(estimated),
    actual_budget: baht(actual),
    today_thai: fmt(new Date().toISOString().slice(0, 10)),
  };

  // 5. Render
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
    console.error("[travel-merge] render failed:", err);
    throw new Error("สร้างเอกสารจากเทมเพลตไม่สำเร็จ — ตรวจสอบ placeholder ในเทมเพลต");
  }

  const safeName = (r.employee?.full_name ?? "travel").replace(/[^a-zA-Z0-9ก-๙]/g, "_");
  return { buffer, filename: `คำสั่งไปราชการ-${safeName}-${travelRequestId.slice(0, 8)}.docx` };
}
