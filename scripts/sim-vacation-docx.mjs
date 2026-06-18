/**
 * SIMULATION (one-off): จำลองเส้นทางการส่ง "ใบลาพักผ่อน" → mail-merge ลง .docx
 *
 * ทำซ้ำ logic เดียวกับ lib/document-templates/leave-merge.ts (generateLeaveDocx)
 * แต่เติมด้วยข้อมูลตัวอย่างที่ "ติดป้ายชัดเจน" เพื่อดูว่า placeholder ในเทมเพลตที่
 * admin อัปโหลด ถูกแทนค่าในตำแหน่งที่ถูกต้องหรือไม่.
 *
 * Output:
 *   1) รายการ placeholder {...} ที่พบในเทมเพลต (ผู้ทำเทมเพลตวางไว้)
 *   2) ตรวจ cross-check กับ key ที่ระบบเติม → unknown / unused
 *   3) เขียนไฟล์ผลลัพธ์ออกมาที่ scripts/out/ + dump ข้อความหลัง merge
 *
 * Run: node scripts/sim-vacation-docx.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  let raw = "";
  try { raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8"); } catch {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("ERROR: Supabase env missing"); process.exit(1); }
const supa = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// ── ข้อมูลตัวอย่างแบบติดป้าย (ดูง่ายในเอกสารผลลัพธ์ว่าค่าไหนลงช่องไหน) ──
const data = {
  title_th: "นาย",
  full_name: "สมชาย ใจดี",
  position: "ครู",
  department: "กลุ่มสาระการเรียนรู้คณิตศาสตร์",
  leave_type: "ลาพักผ่อน",
  start_date: "1 กรกฎาคม 2569",
  end_date: "3 กรกฎาคม 2569",
  total_days: 3,
  working_days: 3,
  reason: "พักผ่อนประจำปี",
  contact: "081-234-5678",
  edd: "",
  accumulated_days: 7,
  annual_days: 10,
  total_entitlement: 17,   // = accumulated + annual
  used_before: 2,          // ลามาแล้วปีงบฯ นี้ (ไม่รวมครั้งนี้)
  used_total: 5,           // = used_before + working_days(3)
  remaining_days: 12,      // = 17 - 5
  substitute_1: "สมหญิง รักเรียน",
  substitute_2: "สมศักดิ์ ขยัน",
  substitute_3: "สมปอง ตั้งใจ",
  branch_head_opinion: "เห็นควรอนุญาต",
  today_thai: "18 มิถุนายน 2569",
};

async function main() {
  // 1. ดึง template VACATION ที่ active (เหมือน pickTemplate ใน leave-merge.ts)
  const { data: tpl, error: tErr } = await supa
    .from("document_templates")
    .select("storage_path, name")
    .eq("doc_type", "leave").eq("is_active", true).eq("leave_type_code", "VACATION")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (tErr || !tpl) { console.error("ไม่พบเทมเพลต VACATION:", tErr?.message); process.exit(1); }
  console.log(`เทมเพลต: ${tpl.name}\npath:    ${tpl.storage_path}\n`);

  // 2. ดาวน์โหลดไบนารี
  const { data: file, error: dErr } = await supa.storage.from("templates").download(tpl.storage_path);
  if (dErr || !file) { console.error("โหลดไฟล์เทมเพลตไม่สำเร็จ:", dErr?.message); process.exit(1); }
  const arrayBuf = await file.arrayBuffer();

  // 3. หา placeholder ที่ผู้ทำเทมเพลตวางไว้ (อ่าน text รวมจาก document.xml + header/footer)
  const zipRaw = new PizZip(Buffer.from(arrayBuf));
  const xmlParts = Object.keys(zipRaw.files).filter((f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f));
  let combinedText = "";
  for (const p of xmlParts) combinedText += zipRaw.files[p].asText();
  // strip XML tags ที่อาจคั่นกลาง {place}{holder} ออกก่อน เพื่อจับ placeholder ที่ถูกแบ่ง run
  const stripped = combinedText.replace(/<[^>]+>/g, "");
  const found = [...stripped.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim());
  const uniqueFound = [...new Set(found)];
  const knownKeys = Object.keys(data);

  console.log("── placeholder ที่พบในเทมเพลต ──");
  for (const ph of uniqueFound) {
    const ok = knownKeys.includes(ph);
    console.log(`  ${ok ? "✓" : "✗ UNKNOWN"}  {${ph}}${ok ? "" : "  ← ระบบไม่มี key นี้ (จะถูกแทนเป็นค่าว่าง)"}`);
  }
  const unused = knownKeys.filter((k) => !uniqueFound.includes(k));
  console.log("\n── key ที่ระบบเติมได้แต่เทมเพลตไม่ได้ใช้ ──");
  console.log(unused.length ? "  " + unused.join(", ") : "  (ไม่มี — เทมเพลตใช้ครบทุก key ที่เกี่ยวข้อง)");

  // 4. merge (พารามิเตอร์เดียวกับ leave-merge.ts)
  const zip = new PizZip(Buffer.from(arrayBuf));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
  doc.render(data);
  const buffer = doc.getZip().generate({ type: "nodebuffer" });

  mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
  const outPath = new URL("./out/sim-ใบลาพักผ่อน.docx", import.meta.url);
  writeFileSync(outPath, buffer);

  // 5. dump ข้อความหลัง merge (เฉพาะ body) เพื่อดูว่าค่าลงตำแหน่งถูกไหม
  const outZip = new PizZip(buffer);
  const bodyText = outZip.files["word/document.xml"].asText().replace(/<[^>]+>/g, "");
  console.log("\n── ข้อความ body หลัง merge (ตัด tag XML) ──\n");
  console.log(bodyText.replace(/\s{2,}/g, " ").trim());
  console.log(`\n✓ เขียนไฟล์ผลลัพธ์: scripts/out/sim-ใบลาพักผ่อน.docx`);
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
