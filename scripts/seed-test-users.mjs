/**
 * Seed 4 test users (one per role) with email+password sign-in.
 *
 * Run: `node scripts/seed-test-users.mjs`
 * Tear down with: `node scripts/delete-test-users.mjs`
 *
 * Uses the service-role key from .env.local to bypass RLS + the
 * email-domain allowlist (we control the domain anyway). Emails
 * use the allowed domain (g.lpru.ac.th) so that if the gate is ever
 * applied to password sign-in, these accounts still pass.
 *
 * Safe to re-run: skips users that already exist by email.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ─── load .env.local ─────────────────────────────────────────
function loadEnv() {
  let raw = "";
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Test users ──────────────────────────────────────────────
// Shared password — known only here. Rotate or delete after rollout.
export const TEST_PASSWORD = "TestPass123!";

export const TEST_USERS = [
  { email: "test-admin@g.lpru.ac.th",    fullName: "ทดสอบ แอดมิน",    role: "admin"    },
  { email: "test-hr@g.lpru.ac.th",       fullName: "ทดสอบ ทรัพยากร",  role: "hr"       },
  { email: "test-manager@g.lpru.ac.th",  fullName: "ทดสอบ ผู้จัดการ",   role: "manager"  },
  { email: "test-employee@g.lpru.ac.th", fullName: "ทดสอบ พนักงาน",   role: "employee" },
];

// ─── Helpers ─────────────────────────────────────────────────
async function findAuthUserByEmail(email) {
  // listUsers paginates 50/page by default; 4 test users won't go beyond page 1.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function fiscalYear() {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

async function initBalancesFor(userId, fy) {
  const { data: types } = await supabase
    .from("leave_types")
    .select("id, code, max_days_per_year");
  if (!types) return;

  for (const lt of types) {
    // Skip if already exists
    const { data: existing } = await supabase
      .from("leave_balances")
      .select("id")
      .eq("employee_id", userId)
      .eq("leave_type_id", lt.id)
      .eq("fiscal_year", fy)
      .maybeSingle();
    if (existing) continue;

    await supabase.from("leave_balances").insert({
      employee_id: userId,
      leave_type_id: lt.id,
      fiscal_year: fy,
      total_days: lt.max_days_per_year,
      used_days: 0,
      accumulated_days: 0,
    });
  }
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const fy = await fiscalYear();
  console.log(`Seeding ${TEST_USERS.length} test users (FY ${fy + 543})...\n`);

  for (const u of TEST_USERS) {
    process.stdout.write(`• ${u.email} (${u.role}) ... `);

    let authId;
    const existing = await findAuthUserByEmail(u.email);
    if (existing) {
      authId = existing.id;
      // Reset the password so the documented credential always works.
      await supabase.auth.admin.updateUserById(authId, { password: TEST_PASSWORD });
      process.stdout.write("auth exists (password reset) · ");
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });
      if (error) {
        console.log(`FAILED: ${error.message}`);
        continue;
      }
      authId = data.user.id;
      process.stdout.write("auth created · ");
    }

    // Upsert profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, role, status")
      .eq("id", authId)
      .maybeSingle();

    if (prof) {
      await supabase
        .from("profiles")
        .update({ role: u.role, status: "approved", full_name: u.fullName })
        .eq("id", authId);
      process.stdout.write("profile updated · ");
    } else {
      const { error: profError } = await supabase.from("profiles").insert({
        id: authId,
        email: u.email,
        full_name: u.fullName,
        role: u.role,
        status: "approved",
      });
      if (profError) {
        console.log(`PROFILE FAILED: ${profError.message}`);
        continue;
      }
      process.stdout.write("profile created · ");
    }

    await initBalancesFor(authId, fy);
    console.log("balances ok");
  }

  console.log(`\n✓ Done. All test users share password: ${TEST_PASSWORD}`);
  console.log("\nUse the password-login form on /login (NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN=true).");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
