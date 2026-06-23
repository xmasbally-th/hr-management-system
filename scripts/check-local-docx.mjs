/**
 * ตรวจไฟล์แม่แบบ .docx ในเครื่อง (ก่อนอัปโหลด): dump ย่อหน้า + merge ข้อมูลตัวอย่าง
 * + cross-check placeholder กับ key ที่ระบบ leave-merge.ts เติมได้.
 *
 * Run: node scripts/check-local-docx.mjs "C:\path\to\file.docx"
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

const path = process.argv[2];
if (!path) { console.error("Usage: node scripts/check-local-docx.mjs <file.docx>"); process.exit(1); }

// ข้อมูลตัวอย่างติดป้าย — ต้องตรงชุด key ที่ leave-merge.ts เติม (รวม placeholder ใหม่)
const data = {
  title_th: "นาย", full_name: "สมชาย ใจดี", position: "ครู",
  department: "กลุ่มสาระการเรียนรู้คณิตศาสตร์", leave_type: "ลาพักผ่อน",
  start_date: "1 กรกฎาคม 2569", end_date: "3 กรกฎาคม 2569",
  total_days: 3, working_days: 3, reason: "พักผ่อนประจำปี", contact: "081-234-5678", edd: "",
  accumulated_days: 7, annual_days: 10,
  total_entitlement: 17, used_before: 2, used_total: 5, remaining_days: 12,
  substitute_1: "สมหญิง รักเรียน", substitute_2: "สมศักดิ์ ขยัน", substitute_3: "สมปอง ตั้งใจ",
  branch_head_opinion: "เห็นควรอนุญาต", today_thai: "18 มิถุนายน 2569",
};
const knownKeys = Object.keys(data);

const buf = readFileSync(path);

// 1. dump ย่อหน้า (placeholder คงไว้)
const zip0 = new PizZip(buf);
const paras = zip0.files["word/document.xml"].asText()
  .split(/<\/w:p>/).map((p) => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
console.log("══ โครงสร้างแม่แบบ (placeholder คงไว้) ══");
paras.forEach((p, i) => console.log(`${String(i).padStart(3)} | ${p}`));

// 2. cross-check placeholder
const xmlParts = Object.keys(zip0.files).filter((f) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f));
let combined = ""; for (const p of xmlParts) combined += zip0.files[p].asText();
const found = [...new Set([...combined.replace(/<[^>]+>/g, "").matchAll(/\{([^{}]+)\}/g)].map((m) => m[1].trim()))];
console.log("\n══ placeholder ที่พบในแม่แบบ ══");
for (const ph of found) {
  const ok = knownKeys.includes(ph);
  console.log(`  ${ok ? "✓" : "✗ UNKNOWN"}  {${ph}}${ok ? "" : "  ← ระบบไม่มี key นี้ (จะว่าง)"}`);
}
const unused = knownKeys.filter((k) => !found.includes(k));
console.log("\n  key ที่ระบบเติมได้แต่แม่แบบไม่ใช้:", unused.length ? unused.join(", ") : "(ไม่มี)");

// 3. merge
const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
doc.render(data);
const out = doc.getZip().generate({ type: "nodebuffer" });
mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
writeFileSync(new URL("./out/check-ใบลาพักผ่อน.docx", import.meta.url), out);

// 4. dump ผลหลัง merge (ทีละย่อหน้า)
const outParas = new PizZip(out).files["word/document.xml"].asText()
  .split(/<\/w:p>/).map((p) => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
console.log("\n══ ผลหลัง merge (ทีละย่อหน้า) ══");
outParas.forEach((p, i) => console.log(`${String(i).padStart(3)} | ${p}`));
console.log("\n✓ ไฟล์ผลลัพธ์: scripts/out/check-ใบลาพักผ่อน.docx");
