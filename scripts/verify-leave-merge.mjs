/**
 * ยืนยัน generateLeaveDocx() กับใบลา "จริง" 1 ใบ — ทำซ้ำ logic ใน
 * lib/document-templates/leave-merge.ts ทุกขั้น (เลือกเทมเพลต → ดึงข้อมูล →
 * คำนวณสถิติลาพักผ่อน → merge) แล้วเขียน .docx + dump ค่าที่เติม.
 *
 * Run: node scripts/verify-leave-merge.mjs <leave_request_id>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
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

const COMMITTED = ["pending","awaiting_director","awaiting_dean","approved","awaiting_university","completed"];
const id = process.argv[2];
if (!id) { console.error("Usage: node scripts/verify-leave-merge.mjs <leave_id>"); process.exit(1); }

// helper เลียนแบบ formatThai (ค.ศ.→พ.ศ. + เดือนไทย)
const TH_MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function fmt(d) { if (!d) return ""; const dt = new Date(d); if (isNaN(dt)) return d; return `${dt.getUTCDate()} ${TH_MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()+543}`; }
function currentFiscalYear(dt) { const m = dt.getUTCMonth(), y = dt.getUTCFullYear(); return m >= 9 ? y + 1 : y; }
function fiscalYearRange(fy) { const ce = fy; const p = (y,mo,da)=>`${y}-${String(mo).padStart(2,"0")}-${String(da).padStart(2,"0")}`; return { start: p(ce-1,10,1), end: p(ce,9,30) }; }

async function main() {
  const { data: leave } = await supa.from("leave_requests").select(
    `*, leave_type:leave_types(name, code),
     employee:profiles!leave_requests_employee_id_fkey(title_th, full_name, position_title, department:departments(name)),
     vacation:leave_vacation_details(*)`).eq("id", id).single();
  if (!leave) { console.error("ไม่พบใบลา"); process.exit(1); }
  const l = leave; const code = l.leave_type?.code ?? null;

  const pick = async (cf) => { let q = supa.from("document_templates").select("storage_path, name").eq("doc_type","leave").eq("is_active",true);
    q = cf === null ? q.is("leave_type_code", null) : q.eq("leave_type_code", cf);
    const { data } = await q.order("created_at",{ascending:false}).limit(1).maybeSingle(); return data; };
  const tpl = (code ? await pick(code) : null) ?? (await pick(null));
  if (!tpl) { console.error(`✗ ไม่มีเทมเพลตสำหรับ code=${code} (และไม่มีเทมเพลตทั่วไป) → route จะตอบ 400`); process.exit(1); }
  console.log(`เทมเพลต: ${tpl.name}  (code=${code})`);

  const { data: file } = await supa.storage.from("templates").download(tpl.storage_path);
  const arrayBuf = await file.arrayBuffer();

  const vac = Array.isArray(l.vacation) ? l.vacation[0] : l.vacation;
  const subNames = { substitute_1:"", substitute_2:"", substitute_3:"" };
  if (vac) {
    const ids = [vac.substitute_1_id, vac.substitute_2_id, vac.substitute_3_id].filter(Boolean);
    if (ids.length) { const { data: profs } = await supa.from("profiles").select("id, full_name").in("id", ids);
      const by = new Map((profs??[]).map(p=>[p.id,p.full_name]));
      subNames.substitute_1 = vac.substitute_1_id ? by.get(vac.substitute_1_id)??"" : "";
      subNames.substitute_2 = vac.substitute_2_id ? by.get(vac.substitute_2_id)??"" : "";
      subNames.substitute_3 = vac.substitute_3_id ? by.get(vac.substitute_3_id)??"" : ""; } }

  const stats = { total_entitlement:"", used_before:"", used_total:"", remaining_days:"" };
  if (vac) {
    const entitlement = Number(vac.accumulated_days??0) + Number(vac.annual_days??0);
    const usedThis = Number(l.working_days ?? l.total_days ?? 0);
    const fy = currentFiscalYear(new Date(l.start_date));
    const { start, end } = fiscalYearRange(fy);
    const { data: others } = await supa.from("leave_requests").select("working_days, total_days, status")
      .eq("employee_id", l.employee_id).eq("leave_type_id", l.leave_type_id).neq("id", l.id)
      .gte("start_date", start).lte("start_date", end);
    const usedBefore = (others??[]).filter(r=>COMMITTED.includes(r.status))
      .reduce((s,r)=>s+Number(r.working_days ?? r.total_days ?? 0),0);
    const usedTotal = usedBefore + usedThis;
    stats.total_entitlement = entitlement; stats.used_before = usedBefore;
    stats.used_total = usedTotal; stats.remaining_days = entitlement - usedTotal;
  }

  const data = {
    title_th: l.employee?.title_th??"", full_name: l.employee?.full_name??"",
    position: l.employee?.position_title??"", department: l.employee?.department?.name??"",
    leave_type: l.leave_type?.name??"", start_date: fmt(l.start_date), end_date: fmt(l.end_date),
    total_days: l.total_days??"", working_days: l.working_days ?? l.total_days ?? "",
    reason: l.reason??"", contact: l.contact_number??"", edd: fmt(l.expected_delivery_date),
    accumulated_days: vac?.accumulated_days??"", annual_days: vac?.annual_days??"",
    branch_head_opinion: vac?.branch_head_opinion??"", today_thai: fmt(new Date().toISOString().slice(0,10)),
    ...stats, ...subNames,
  };

  console.log("\n── ค่าที่ระบบจะเติม ──");
  for (const [k,v] of Object.entries(data)) console.log(`  ${k.padEnd(18)} = ${v === "" ? "(ว่าง)" : v}`);

  const doc = new Docxtemplater(new PizZip(Buffer.from(arrayBuf)), { paragraphLoop:true, linebreaks:true, nullGetter:()=>"" });
  doc.render(data);
  const out = doc.getZip().generate({ type:"nodebuffer" });
  mkdirSync(new URL("./out/", import.meta.url), { recursive:true });
  writeFileSync(new URL("./out/verify-ใบลาพักผ่อน.docx", import.meta.url), out);
  console.log("\n✓ merge สำเร็จ → scripts/out/verify-ใบลาพักผ่อน.docx (route จริงจะส่งไฟล์นี้)");
}
main().catch(e=>{ console.error("ERROR:", e); process.exit(1); });
