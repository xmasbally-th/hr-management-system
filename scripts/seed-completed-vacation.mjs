/**
 * Seed ใบลาพักผ่อน "completed" 1 ใบ ให้ test-employee พร้อมข้อมูลครบสำหรับ
 * ทดสอบดาวน์โหลด .docx (W3) — vacation_details (สะสม/ประจำปี) + ผู้ปฏิบัติแทน
 * 3 คน + branch_head_opinion + document_tracking.
 *
 * Run:  node scripts/seed-completed-vacation.mjs
 * Idempotent: ลบใบเดิมที่มี marker ก่อน แล้ว insert ใหม่.
 *
 * หมายเหตุสถิติที่จะโชว์ในเอกสาร: test-employee มี VACATION approved อยู่แล้ว
 * 3 วันใน FY2026 → ระบบจะคำนวณ "ลามาแล้ว = 3", "ลาครั้งนี้ = 5",
 * "รวมเป็น = 8", "คงเหลือ = (สะสม4+ประจำปี10) − 8 = 6".
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  let raw = ""; try { raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i); if (!m) continue;
    let v = m[2]; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv();
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });

const MARKER = "[ตัวอย่าง-completed-vac]";

async function idByEmail(email) {
  const { data } = await supa.from("profiles").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

async function main() {
  const empId = await idByEmail("test-employee@g.lpru.ac.th");
  if (!empId) { console.error("ไม่พบ test-employee — รัน seed-test-users.mjs ก่อน"); process.exit(1); }
  const [sub1, sub2, sub3] = await Promise.all([
    idByEmail("test-manager@g.lpru.ac.th"),
    idByEmail("test-hr@g.lpru.ac.th"),
    idByEmail("test-admin@g.lpru.ac.th"),
  ]);
  const { data: vt } = await supa.from("leave_types").select("id").eq("code", "VACATION").maybeSingle();
  if (!vt) { console.error("ไม่พบ leave_type VACATION"); process.exit(1); }

  // 1. wipe prior sample (cascade ลบ vacation_details/tracking ผ่าน FK ถ้าตั้งไว้ — ลบ tracking เองกันพลาด)
  const { data: prior } = await supa.from("leave_requests").select("id")
    .eq("employee_id", empId).like("reason", `${MARKER}%`);
  for (const r of prior ?? []) {
    await supa.from("document_tracking").delete().eq("reference_id", r.id);
    await supa.from("leave_vacation_details").delete().eq("request_id", r.id);
  }
  if (prior?.length) await supa.from("leave_requests").delete().eq("employee_id", empId).like("reason", `${MARKER}%`);

  // 2. insert completed vacation leave (FY2026 = Oct2025–Sep2026)
  const { data: ins, error } = await supa.from("leave_requests").insert({
    employee_id: empId, leave_type_id: vt.id,
    start_date: "2026-07-01", end_date: "2026-07-07",
    total_days: 7, working_days: 5,
    reason: `${MARKER} พักผ่อนประจำปี (ทดสอบดาวน์โหลด)`,
    contact_number: "081-234-5678",
    submission_channel: "digital", status: "completed",
  }).select("id").single();
  if (error) { console.error("insert leave FAILED:", error.message); process.exit(1); }
  const leaveId = ins.id;

  // 3. vacation details + substitutes + branch head opinion
  const { error: vErr } = await supa.from("leave_vacation_details").insert({
    request_id: leaveId,
    accumulated_days: 4, annual_days: 10,
    substitute_1_id: sub1, substitute_2_id: sub2, substitute_3_id: sub3,
    branch_head_opinion: "เห็นควรอนุญาต",
  });
  if (vErr) console.warn("vacation_details:", vErr.message);

  // 4. document_tracking
  const { error: dErr } = await supa.from("document_tracking")
    .insert({ reference_id: leaveId, document_type: "leave" });
  if (dErr) console.warn("document_tracking:", dErr.message);

  console.log("✓ สร้างใบลาพักผ่อน completed แล้ว");
  console.log("  leave id:", leaveId);
  console.log("  ผู้ขอลา: test-employee | สะสม 4 + ประจำปี 10 | ลาครั้งนี้ 5 วันทำการ");
  console.log("  ผู้ปฏิบัติแทน:", [sub1, sub2, sub3].filter(Boolean).length, "คน");
  console.log("\n  ทดสอบดาวน์โหลด: /dashboard/leaves/" + leaveId + "  → ปุ่มดาวน์โหลด .docx");
}
main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
