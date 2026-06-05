/**
 * Delete the 4 test users created by `seed-test-users.mjs`.
 *
 * Run: `node scripts/delete-test-users.mjs`
 *
 * Removes auth.users rows; related rows in `profiles`, `leave_balances`,
 * `leave_requests`, etc. cascade via FK on profiles.id. If your schema
 * lacks cascading FKs for any table, this will fail and you'll need to
 * delete those rows manually first.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { TEST_USERS } from "./seed-test-users.mjs";

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

async function findAuthUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function main() {
  console.log(`Deleting ${TEST_USERS.length} test users...\n`);

  for (const u of TEST_USERS) {
    process.stdout.write(`• ${u.email} ... `);
    const existing = await findAuthUserByEmail(u.email);
    if (!existing) {
      console.log("not found");
      continue;
    }

    // Best-effort: clean dependent rows that may not cascade
    await supabase.from("leave_balances").delete().eq("employee_id", existing.id);
    await supabase.from("leave_requests").delete().eq("employee_id", existing.id);
    await supabase.from("profiles").delete().eq("id", existing.id);

    const { error } = await supabase.auth.admin.deleteUser(existing.id);
    if (error) {
      console.log(`FAILED: ${error.message}`);
      continue;
    }
    console.log("deleted");
  }

  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});
