/** dump เทมเพลต VACATION (ก่อน merge) เป็นข้อความ พร้อม placeholder คงไว้ เพื่อดูบริบทแต่ละช่อง */
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
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
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: tpl } = await supa.from("document_templates").select("storage_path")
  .eq("doc_type", "leave").eq("is_active", true).eq("leave_type_code", "VACATION").limit(1).maybeSingle();
const { data: file } = await supa.storage.from("templates").download(tpl.storage_path);
const zip = new PizZip(Buffer.from(await file.arrayBuffer()));
// แสดงทีละ paragraph: ใช้ </w:p> เป็นตัวแบ่งบรรทัด
const xml = zip.files["word/document.xml"].asText();
const paras = xml.split(/<\/w:p>/).map((p) => p.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
paras.forEach((p, i) => console.log(`${String(i).padStart(3)} | ${p}`));
