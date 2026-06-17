/**
 * Seed sample travel_requests for test-employee so the travel hub
 * (/dashboard/hr/travel) — its รอดำเนินการ queue, คำขอทั้งหมด list, budget
 * ภาพรวม, ติดตามเอกสาร timeline — plus the detail-page stepper all have data
 * to exercise. Rows cover every workflow stage and carry estimated/actual
 * budget so the two-phase budget separation is visible.
 *
 * Run: `node scripts/seed-sample-travel.mjs`
 *
 * Idempotent: deletes prior sample rows (title prefixed with the marker) and
 * their travel_expenses / document_tracking before re-inserting.
 *
 * Cleanup: `delete-test-users.mjs` removes every travel_request for the test
 * users, so no separate teardown is needed.
 */
import { readFileSync } from "node:fs";
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
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const MARKER = "[ตัวอย่าง]";

// Sample rows — dates within FY2569 round 2 (Apr–Sep 2026), one per workflow
// stage. `expenses` are estimated; `actuals` (parallel array) fill the actual
// column once budget can be disbursed (approved/completed). `tracking` carries
// the signature-workflow dates so the document timeline renders for each stage.
const samples = [
  {
    type: "training", title: "อบรมเชิงปฏิบัติการ AI ภาครัฐ", location: "กรุงเทพมหานคร",
    start: "2026-06-15", end: "2026-06-17", days: 3, status: "pending",
    expenses: [["ค่าที่พัก", 4500], ["ค่าพาหนะ", 2000], ["ค่าเบี้ยเลี้ยง", 720]],
    actuals: [], tracking: {},
  },
  {
    type: "supervision", title: "นิเทศนักศึกษาฝึกประสบการณ์", location: "ลำปาง",
    start: "2026-06-20", end: "2026-06-20", days: 1, status: "awaiting_director",
    expenses: [["ค่าพาหนะ", 1200], ["ค่าเบี้ยเลี้ยง", 240]],
    actuals: [], tracking: { sent_to_director_date: "2026-06-10" },
  },
  {
    type: "official_contact", title: "ติดต่อราชการกรมบัญชีกลาง", location: "กรุงเทพมหานคร",
    start: "2026-07-01", end: "2026-07-02", days: 2, status: "awaiting_dean",
    expenses: [["ค่าที่พัก", 3000], ["ค่าพาหนะ", 2500]],
    actuals: [],
    tracking: { sent_to_director_date: "2026-06-18", director_signed_date: "2026-06-20", sent_to_dean_date: "2026-06-21" },
  },
  {
    type: "training", title: "สัมมนาพัฒนาหลักสูตร", location: "เชียงใหม่",
    start: "2026-05-12", end: "2026-05-14", days: 3, status: "approved",
    expenses: [["ค่าที่พัก", 5000], ["ค่าพาหนะ", 3000], ["ค่าลงทะเบียน", 2500]],
    actuals: [4800, 2950, 2500],
    tracking: {
      sent_to_director_date: "2026-05-01", director_signed_date: "2026-05-03",
      sent_to_dean_date: "2026-05-04", dean_signed_date: "2026-05-06",
    },
  },
  {
    type: "official_contact", title: "ประชุมเครือข่ายมหาวิทยาลัยราชภัฏ", location: "พิษณุโลก",
    start: "2026-05-20", end: "2026-05-21", days: 2, status: "awaiting_university",
    expenses: [["ค่าที่พัก", 2800], ["ค่าพาหนะ", 1800]],
    actuals: [],
    tracking: {
      sent_to_director_date: "2026-05-08", director_signed_date: "2026-05-10",
      sent_to_dean_date: "2026-05-11", dean_signed_date: "2026-05-13",
      sent_to_president_date: "2026-05-15",
    },
  },
  {
    type: "supervision", title: "นิเทศสหกิจศึกษา ภาคเรียนที่ 1", location: "เชียงราย",
    start: "2026-04-22", end: "2026-04-24", days: 3, status: "completed",
    expenses: [["ค่าที่พัก", 4500], ["ค่าพาหนะ", 3200], ["ค่าเบี้ยเลี้ยง", 720]],
    actuals: [4500, 3050, 720],
    tracking: {
      sent_to_director_date: "2026-04-10", director_signed_date: "2026-04-12",
      sent_to_dean_date: "2026-04-13", dean_signed_date: "2026-04-15",
      sent_to_president_date: "2026-04-17", president_signed_date: "2026-04-20",
    },
  },
  {
    type: "training", title: "อบรมระบบสารบรรณอิเล็กทรอนิกส์", location: "กรุงเทพมหานคร",
    start: "2026-07-10", end: "2026-07-11", days: 2, status: "rejected",
    expenses: [["ค่าที่พัก", 3000], ["ค่าพาหนะ", 2200]],
    actuals: [], tracking: {},
  },
];

async function main() {
  const { data: emp } = await supabase
    .from("profiles").select("id").eq("email", "test-employee@g.lpru.ac.th").maybeSingle();
  if (!emp) { console.error("test-employee not found — run seed-test-users.mjs first"); process.exit(1); }

  // 1. wipe prior samples (expenses + tracking cascade off the request id)
  const { data: prior } = await supabase
    .from("travel_requests").select("id").eq("employee_id", emp.id).like("title", `${MARKER}%`);
  const priorIds = (prior ?? []).map((r) => r.id);
  if (priorIds.length) {
    await supabase.from("travel_expenses").delete().in("travel_request_id", priorIds);
    await supabase.from("document_tracking").delete().in("reference_id", priorIds);
    const { error: delErr } = await supabase.from("travel_requests").delete().in("id", priorIds);
    if (delErr) console.warn("delete prior samples:", delErr.message);
    else console.log(`• cleared ${priorIds.length} prior sample(s)`);
  }

  // 2. insert samples
  for (const s of samples) {
    const { data: req, error } = await supabase.from("travel_requests").insert({
      employee_id: emp.id,
      travel_type: s.type,
      title: `${MARKER} ${s.title}`,
      location: s.location,
      start_date: s.start,
      end_date: s.end,
      total_days: s.days,
      submission_channel: "digital",
      status: s.status,
    }).select("id").single();
    if (error) { console.error(`insert "${s.title}" FAILED:`, error.message); continue; }

    const expenseRows = s.expenses.map(([category, est], i) => ({
      travel_request_id: req.id,
      expense_category: category,
      estimated_amount: est,
      actual_amount: s.actuals[i] ?? null,
    }));
    const { error: expErr } = await supabase.from("travel_expenses").insert(expenseRows);
    if (expErr) console.warn(`  expenses "${s.title}":`, expErr.message);

    const { error: dtErr } = await supabase
      .from("document_tracking")
      .insert({ reference_id: req.id, document_type: "travel", ...s.tracking });
    if (dtErr) console.warn(`  tracking "${s.title}":`, dtErr.message);

    const est = s.expenses.reduce((a, [, v]) => a + v, 0);
    console.log(`• ${s.status.padEnd(20)} ${s.start}→${s.end} ${s.days}d  งบ ${est.toLocaleString()}฿  ${s.title}`);
  }

  console.log("\n✓ Sample travel requests seeded for test-employee (FY2569 round 2).");
  console.log("  • pending/awaiting_* → appear in รอดำเนินการ queue (HR sees all in-progress)");
  console.log("  • approved/completed → carry actual budget for the ภาพรวม summary");
  console.log("  • each row has a document_tracking timeline + stepper state to view");
}

main().catch(e => { console.error("ERROR:", e); process.exit(1); });
