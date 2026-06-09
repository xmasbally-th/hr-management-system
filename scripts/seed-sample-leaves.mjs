/**
 * Seed sample leave_requests for test-employee so the approval queue
 * (manager/hr) and the leave history table have data to exercise.
 *
 * Run: `node scripts/seed-sample-leaves.mjs`
 *
 * Idempotent: deletes prior sample rows (reason prefixed with the marker)
 * before re-inserting, then recomputes used_days/remaining_days on the
 * affected leave_balances (reserve-on-submit model — committed statuses
 * consume quota).
 *
 * Cleanup: `delete-test-users.mjs` already removes every leave_request for
 * the test users, so no separate teardown is needed.
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
const FY = 2026; // FY 2569 (Oct 2025 – Sep 2026)

// committed statuses consume quota (mirror of lib/leave-rules.ts)
const COMMITTED = ["pending","awaiting_director","awaiting_dean","approved","awaiting_university","completed"];

async function main() {
  const { data: emp } = await supabase
    .from("profiles").select("id").eq("email", "test-employee@g.lpru.ac.th").maybeSingle();
  if (!emp) { console.error("test-employee not found — run seed-test-users.mjs first"); process.exit(1); }

  const { data: types } = await supabase.from("leave_types").select("id, code");
  const byCode = Object.fromEntries((types ?? []).map(t => [t.code, t.id]));

  // 1. wipe prior samples
  const { error: delErr } = await supabase
    .from("leave_requests").delete().eq("employee_id", emp.id).like("reason", `${MARKER}%`);
  if (delErr) console.warn("delete prior samples:", delErr.message);

  // 2. sample rows (dates within FY2569 round 2 = Apr–Sep 2026)
  const samples = [
    { code: "SICK",     start: "2026-06-15", end: "2026-06-16", days: 2, status: "pending",  reason: "ไม่สบาย เป็นไข้", contact: "0812345678" },
    { code: "PERSONAL", start: "2026-06-22", end: "2026-06-22", days: 1, status: "pending",  reason: "ติดธุระส่วนตัว",   contact: "0812345678" },
    { code: "VACATION", start: "2026-05-04", end: "2026-05-06", days: 3, status: "approved", reason: "พักผ่อนประจำปี",   contact: "0812345678" },
  ];

  for (const s of samples) {
    const ltId = byCode[s.code];
    if (!ltId) { console.warn(`skip ${s.code}: leave_type not found`); continue; }
    const { data: inserted, error } = await supabase.from("leave_requests").insert({
      employee_id: emp.id,
      leave_type_id: ltId,
      start_date: s.start,
      end_date: s.end,
      total_days: s.days,
      working_days: s.days,
      reason: `${MARKER} ${s.reason}`,
      contact_number: s.contact,
      submission_channel: "digital",
      status: s.status,
    }).select("id").single();
    if (error) { console.error(`insert ${s.code} FAILED:`, error.message); continue; }

    // Document-tracking row so the request can be driven through the
    // signature workflow (createLeaveRequest makes this for real submissions).
    const { error: dtErr } = await supabase
      .from("document_tracking")
      .insert({ reference_id: inserted.id, document_type: "leave" });
    if (dtErr) console.warn(`  tracking insert ${s.code}:`, dtErr.message);

    console.log(`• inserted ${s.code} (${s.status}) ${s.start}→${s.end} ${s.days}d`);
  }

  // 3. recompute used_days / remaining_days for affected types
  const affected = [...new Set(samples.map(s => byCode[s.code]).filter(Boolean))];
  for (const ltId of affected) {
    const { data: reqs } = await supabase
      .from("leave_requests").select("working_days, total_days, status")
      .eq("employee_id", emp.id).eq("leave_type_id", ltId)
      .gte("start_date", "2025-10-01").lte("start_date", "2026-09-30");
    const used = (reqs ?? [])
      .filter(r => COMMITTED.includes(r.status))
      .reduce((sum, r) => sum + Number(r.working_days ?? r.total_days ?? 0), 0);
    const { data: bal } = await supabase
      .from("leave_balances").select("id, total_days, accumulated_days")
      .eq("employee_id", emp.id).eq("leave_type_id", ltId).eq("fiscal_year", FY).maybeSingle();
    if (bal) {
      const entitlement = Number(bal.total_days ?? 0);
      await supabase.from("leave_balances")
        .update({ used_days: used, remaining_days: entitlement - used })
        .eq("id", bal.id);
      console.log(`  ↳ balance ${ltId.slice(0,8)} used=${used} remaining=${entitlement - used}`);
    }
  }

  console.log("\n✓ Sample leaves seeded for test-employee.");
  console.log("  • 2 pending → appear in /dashboard/approvals/leaves (manager/hr)");
  console.log("  • 1 approved → appears in test-employee's leave history");
}

main().catch(e => { console.error("ERROR:", e); process.exit(1); });
