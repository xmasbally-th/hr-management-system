"use server";

import { createClient } from "@/lib/supabase/server";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import type { Database, ProfileStatus, UserRole } from "@/types/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { env } from "@/lib/env";
import { isEmailAllowed } from "@/lib/system-settings";
import { toCanonicalAuthEmail } from "@/lib/auth/canonical-email";
import { rekeyPlaceholderProfile } from "@/lib/auth/rekey-profile";
import { createNotificationInternal } from "./notification-actions";
import { initializeLeaveBalances, initializeAllEmployeesBalances } from "./leave-actions";

/**
 * Validates that the current authenticated user has 'hr' or 'admin' role.
 * Throws an error if not authorized.
 */
async function checkHrAdminRole(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized: Please log in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  return user.id;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  role?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * Retrieves user profiles with pagination, search, and filters.
 * Only accessible by 'admin' and 'hr'.
 */
export async function getProfiles(params?: PaginationParams): Promise<PaginatedResult<Record<string, unknown>>> {
  const supabase = await createClient();
  await checkHrAdminRole(supabase);

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select(`
      *,
      department:departments(name)
    `, { count: "exact" });

  if (params?.status && params.status !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("status", params.status as any);
  }

  if (params?.role && params.role !== "all") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq("role", params.role as any);
  }

  if (params?.search) {
    query = query.or(`full_name.ilike.%${params.search}%,email.ilike.%${params.search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[user-actions] Failed to fetch profiles:", error);
    throw new Error("Failed to fetch profiles");
  }

  return { data: data ?? [], totalCount: count ?? 0, page, pageSize };
}

/**
 * Updates a user's status.
 * Only accessible by 'admin' and 'hr'.
 */
export async function updateUserStatus(userId: string, status: ProfileStatus) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user status:", error);
    throw new Error("Failed to update status");
  }

  await logAudit(supabase, actorId, "update_status", "profile", userId, { status });
  await notifyStatusChange(supabase, userId, status);
  revalidatePath("/dashboard/hr/users");
}

async function notifyStatusChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  status: ProfileStatus,
): Promise<void> {
  const message =
    status === "approved"
      ? "บัญชีของคุณได้รับการอนุมัติแล้ว"
      : status === "rejected"
        ? "บัญชีของคุณถูกระงับการใช้งาน — กรุณาติดต่อ HR"
        : "สถานะบัญชีของคุณกลับเป็น 'รออนุมัติ'";
  try {
    await createNotificationInternal(supabase, userId, `account_${status}`, message);
  } catch (err) {
    console.warn("[user-actions] notifyStatusChange failed:", err);
  }
}

// =============================================================================
// Bulk status updates (Phase M5)
// =============================================================================

export interface BulkResult {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

async function bulkUpdateStatus(
  ids: string[],
  status: ProfileStatus,
): Promise<BulkResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error("ไม่มีผู้ใช้ที่จะดำเนินการ");
  }
  if (ids.length > 100) {
    throw new Error("จำนวนเกิน 100 รายการต่อครั้ง");
  }

  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const result: BulkResult = { success: [], failed: [] };

  for (const id of ids) {
    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id);
    if (error) {
      result.failed.push({ id, error: error.message });
      continue;
    }
    await notifyStatusChange(supabase, id, status);
    result.success.push(id);
  }

  await logAudit(supabase, actorId, `bulk_${status}`, "profile", "batch", {
    total: ids.length,
    success: result.success.length,
    failed: result.failed.length,
  });

  revalidatePath("/dashboard/hr/users");
  return result;
}

export async function bulkApproveUsers(ids: string[]): Promise<BulkResult> {
  return bulkUpdateStatus(ids, "approved");
}

export async function bulkRejectUsers(ids: string[]): Promise<BulkResult> {
  return bulkUpdateStatus(ids, "rejected");
}

/**
 * Updates a user's role.
 * Only accessible by 'admin' and 'hr'.
 */
export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    console.error("[user-actions] Failed to update user role:", error);
    throw new Error("Failed to update role");
  }

  await logAudit(supabase, actorId, "update_role", "profile", userId, { role });

  revalidatePath("/dashboard/hr/users");
}

/**
 * Creates a new user account + profile by Admin/HR.
 * Bypasses normal sign-up using the service role key.
 */
export async function createUserByAdmin(data: {
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  positionId: string | null;
}) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  // Basic input checks
  const email = data.email?.trim().toLowerCase();
  const fullName = data.fullName?.trim();
  if (!email || !fullName) {
    throw new Error("กรุณากรอกชื่อและอีเมลให้ครบถ้วน");
  }

  // Domain allowlist — same gate used at sign-in time, so admins can't
  // create users that would later be blocked from logging in.
  if (!(await isEmailAllowed(email))) {
    throw new Error("โดเมนอีเมลไม่อยู่ในรายการที่อนุญาต");
  }

  // Cross-field validation: if a position is supplied, it must belong to
  // the chosen department. Prevents inconsistency when bypassing the
  // client-side dropdown filter.
  if (data.positionId) {
    if (!data.departmentId) {
      throw new Error("ต้องเลือกแผนกก่อนจึงจะระบุตำแหน่งได้");
    }
    const { data: pos, error: posError } = await supabase
      .from("positions")
      .select("id, department_id")
      .eq("id", data.positionId)
      .maybeSingle();
    if (posError || !pos) {
      throw new Error("ตำแหน่งที่ระบุไม่ถูกต้อง");
    }
    if (pos.department_id !== data.departmentId) {
      throw new Error("ตำแหน่งที่เลือกไม่ได้อยู่ในแผนกที่เลือก");
    }
  }

  const supabaseAdmin = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // 1. Create auth user with random password (user will reset it or use SSO later)
  const tempPassword = Math.random().toString(36).slice(-12) + "A1!";
  
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError) {
    console.error("[user-actions] Failed to create auth user:", authError);
    // Handle specific errors like email already exists
    if (authError.message.includes("already registered") || authError.status === 422) {
      throw new Error("อีเมลนี้มีอยู่ในระบบแล้ว (Email already registered)");
    }
    throw new Error("ไม่สามารถสร้างบัญชีผู้ใช้งานได้");
  }

  if (!authData.user) {
    throw new Error("Failed to create auth user (No user returned)");
  }

  // 2. Insert into profiles with 'approved' status
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role: data.role,
    status: "approved",
    department_id: data.departmentId,
    position_id: data.positionId,
  });

  if (profileError) {
    console.error("[user-actions] Failed to create profile, rolling back:", profileError);
    // Try to rollback the auth user creation since profile failed
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    throw new Error("บันทึกข้อมูลพนักงานไม่สำเร็จ กรุณาลองใหม่");
  }

  await logAudit(supabase, actorId, "create_user", "profile", authData.user.id, { email, role: data.role });

  // Auto-initialize leave balances for the new employee (non-blocking —
  // failure here must not roll back the successful user creation)
  try {
    await initializeLeaveBalances(authData.user.id);
  } catch (e) {
    console.error("[user-actions] auto-init leave balances failed:", e);
  }

  revalidatePath("/dashboard/hr/users");

  return { success: true };
}

/**
 * Find an auth user by email via the admin API. Supabase has no direct
 * get-by-email, so we page through listUsers. For ~100 org users a single
 * large page suffices.
 */
async function findAuthUserByEmail(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<{ id: string } | null> {
  const target = email.toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data) return null;
  const found = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
  return found ? { id: found.id } : null;
}

/**
 * Set (or reset) a user's login password — HR/admin only.
 *
 * For employees who can't access Google SSO: HR issues a password they sign
 * in with (email+password; the @lpru.ac.th address they know is folded to the
 * canonical @g.lpru.ac.th form at login). No email is ever sent — the auth
 * user is created with email_confirm so there is no verification step.
 *
 * Two cases, keyed on whether the profile already has an auth.users row:
 *   - real profile (logged in before / created by admin) → updateUserById
 *   - placeholder profile (HR-imported, never logged in) → createUser with the
 *     canonical email, then re-key the placeholder onto the new auth id
 */
export async function setUserPassword(userId: string, newPassword: string) {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  const password = (newPassword ?? "").trim();
  if (password.length < 8) {
    throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (password.length > 72) {
    throw new Error("รหัสผ่านยาวเกินไป (สูงสุด 72 ตัวอักษร)");
  }

  // Load the target profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) {
    throw new Error("ไม่พบผู้ใช้");
  }

  const authEmail = toCanonicalAuthEmail(profile.email);
  if (!authEmail || !authEmail.includes("@")) {
    throw new Error("ผู้ใช้ไม่มีอีเมลที่ถูกต้อง");
  }

  const supabaseAdmin: SupabaseClient<Database> = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Does an auth user already exist for this profile id?
  const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (existing?.user) {
    // Real account — just set the password.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password,
    });
    if (error) {
      console.error("[user-actions] setUserPassword update failed:", error);
      throw new Error("ตั้งรหัสผ่านไม่สำเร็จ");
    }
  } else {
    // Placeholder — create the auth user, then re-key the placeholder onto it.
    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true, // no verification email — HR is provisioning
        user_metadata: { full_name: profile.full_name },
      });

    let authUserId = created?.user?.id ?? null;
    const weCreatedTheUser = !createError && !!authUserId;

    if (createError) {
      // Email already has an auth user (e.g. signed in via Google before, but
      // this placeholder was never re-keyed). Find it, set its password, link.
      const alreadyExists =
        createError.status === 422 ||
        /already.*(registered|exists)/i.test(createError.message);
      if (!alreadyExists) {
        console.error("[user-actions] setUserPassword create failed:", createError);
        throw new Error("สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ");
      }
      const found = await findAuthUserByEmail(supabaseAdmin, authEmail);
      if (!found) {
        throw new Error("อีเมลนี้มีบัญชีอยู่แล้วแต่ค้นหาไม่พบ กรุณาลองใหม่");
      }
      const { error: updError } = await supabaseAdmin.auth.admin.updateUserById(
        found.id,
        { password },
      );
      if (updError) {
        throw new Error("ตั้งรหัสผ่านไม่สำเร็จ");
      }
      authUserId = found.id;
    }

    if (!authUserId) {
      throw new Error("สร้างบัญชีเข้าสู่ระบบไม่สำเร็จ");
    }

    // Re-key the placeholder profile onto the auth user id.
    if (authUserId !== userId) {
      try {
        await rekeyPlaceholderProfile(
          supabaseAdmin,
          userId,
          authUserId,
          authEmail,
        );
      } catch (err) {
        console.error("[user-actions] setUserPassword re-key failed:", err);
        // Roll back only an auth user WE created — never delete a pre-existing one.
        if (weCreatedTheUser) {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        }
        throw new Error("เชื่อมโยงบัญชีไม่สำเร็จ กรุณาลองใหม่");
      }
    }
  }

  await logAudit(supabase, actorId, "set_user_password", "profile", userId, {
    email: authEmail,
  });
  revalidatePath("/dashboard/hr/users");
  return { success: true };
}

// =============================================================================
// Bulk Import (placeholder profile mode — Phase M2)
// =============================================================================

export interface ImportRow {
  email: string;
  title_th?: string | null;
  first_name_th?: string | null;
  last_name_th?: string | null;
  title_en?: string | null;
  first_name_en?: string | null;
  last_name_en?: string | null;
  position_number?: string | null;
  position_title?: string | null;
  employee_type?: string | null;
  department_name?: string | null;
  education_level?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  gender?: string | null;
  phone?: string | null;
  current_address?: string | null;
  role?: string | null;
}

export interface ImportResult {
  success: Array<{ row: number; email: string }>;
  failed: Array<{ row: number; email: string; error: string }>;
  skipped: Array<{ row: number; email: string; reason: string }>;
}

const VALID_ROLES: UserRole[] = ["employee", "manager", "hr", "admin"];

function trim(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  // Strip Excel text-guard wrapper: ="..."  →  ...
  // This appears when the user opens the template in Excel and re-saves —
  // our generated template intentionally wraps phone/position_number so
  // Excel preserves leading zeros.
  const m = s.match(/^="([\s\S]*)"$/);
  if (m) s = m[1];
  return s.length > 0 ? s : null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildFullName(r: ImportRow, fallbackEmail: string): string {
  const parts = [r.title_th, r.first_name_th, r.last_name_th].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  const en = [r.title_en, r.first_name_en, r.last_name_en].filter(Boolean);
  if (en.length > 0) return en.join(" ");
  return fallbackEmail.split("@")[0];
}

/**
 * Bulk-import employees from a parsed CSV/XLSX as **placeholder profiles**.
 *
 * Each row is INSERTed into `profiles` with a fresh UUID. No auth.users row
 * is created — the user picks up the placeholder when they sign in via
 * Google for the first time (callback re-keys by email match).
 *
 * Returns per-row success/failed/skipped summaries so the UI can show a
 * report and let HR download a CSV of failures.
 */
export async function bulkImportEmployees(
  rows: ImportRow[],
): Promise<ImportResult> {
  const supabase = await createClient();
  const actorId = await checkHrAdminRole(supabase);
  checkRateLimit(actorId);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("ไม่มีข้อมูลที่จะนำเข้า");
  }
  if (rows.length > 500) {
    throw new Error("จำนวนแถวเกิน 500 รายการ — กรุณาแบ่งไฟล์");
  }

  const supabaseAdmin = createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // Pre-fetch reference data
  const [{ data: existingProfiles }, { data: departments }] = await Promise.all([
    supabaseAdmin.from("profiles").select("email"),
    supabaseAdmin.from("departments").select("id, name"),
  ]);

  const existingEmails = new Set(
    (existingProfiles ?? []).map((p) => p.email.toLowerCase()),
  );
  const deptByName = new Map<string, string>();
  for (const d of departments ?? []) {
    deptByName.set(d.name.toLowerCase(), d.id);
  }

  const result: ImportResult = { success: [], failed: [], skipped: [] };
  const seenInBatch = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Trim/normalize
    const email = trim(row.email)?.toLowerCase() ?? "";

    if (!email) {
      result.failed.push({ row: rowNum, email: "", error: "ไม่มีอีเมล" });
      continue;
    }
    if (!isValidEmail(email)) {
      result.failed.push({ row: rowNum, email, error: "รูปแบบอีเมลไม่ถูกต้อง" });
      continue;
    }
    if (!(await isEmailAllowed(email))) {
      result.failed.push({
        row: rowNum,
        email,
        error: "โดเมนอีเมลไม่อยู่ในรายการที่อนุญาต",
      });
      continue;
    }
    if (existingEmails.has(email)) {
      result.skipped.push({ row: rowNum, email, reason: "มีในระบบแล้ว" });
      continue;
    }
    if (seenInBatch.has(email)) {
      result.skipped.push({
        row: rowNum,
        email,
        reason: "อีเมลซ้ำในไฟล์เดียวกัน",
      });
      continue;
    }
    seenInBatch.add(email);

    // Resolve department
    const deptName = trim(row.department_name);
    let departmentId: string | null = null;
    if (deptName) {
      const resolved = deptByName.get(deptName.toLowerCase());
      if (!resolved) {
        result.failed.push({
          row: rowNum,
          email,
          error: `ไม่พบแผนก "${deptName}"`,
        });
        continue;
      }
      departmentId = resolved;
    }

    // Resolve role
    const roleRaw = trim(row.role)?.toLowerCase();
    let role: UserRole = "employee";
    if (roleRaw) {
      if (VALID_ROLES.includes(roleRaw as UserRole)) {
        role = roleRaw as UserRole;
      } else {
        result.failed.push({
          row: rowNum,
          email,
          error: `role ไม่ถูกต้อง (${roleRaw})`,
        });
        continue;
      }
    }

    // Build INSERT payload
    const fullName = buildFullName(row, email);
    const insertData = {
      // Placeholder id — re-keyed on first login. crypto.randomUUID() is
      // available in Node 19+ (Vercel runtime supports it).
      id: crypto.randomUUID(),
      email,
      full_name: fullName,
      title_th: trim(row.title_th),
      title_en: trim(row.title_en),
      first_name_th: trim(row.first_name_th),
      first_name_en: trim(row.first_name_en),
      last_name_th: trim(row.last_name_th),
      last_name_en: trim(row.last_name_en),
      position_number: trim(row.position_number),
      position_title: trim(row.position_title),
      employee_type: trim(row.employee_type),
      department_id: departmentId,
      education_level: trim(row.education_level),
      birth_date: trim(row.birth_date),
      hire_date: trim(row.hire_date),
      gender: trim(row.gender),
      phone: trim(row.phone),
      current_address: trim(row.current_address),
      role,
      status: "approved" as ProfileStatus,
      // HR is filling the profile on behalf of the employee — mark as
      // complete so the user doesn't get stuck on a welcome page.
      profile_completed_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert(insertData);

    if (insertError) {
      result.failed.push({
        row: rowNum,
        email,
        error: insertError.message,
      });
      continue;
    }

    existingEmails.add(email);
    result.success.push({ row: rowNum, email });
  }

  // Audit
  await logAudit(supabase, actorId, "bulk_import_users", "profile", "batch", {
    total: rows.length,
    success: result.success.length,
    failed: result.failed.length,
    skipped: result.skipped.length,
  });

  // Auto-initialize leave balances for newly imported employees (one batch
  // pass, idempotent — non-blocking so import result is preserved on failure)
  if (result.success.length > 0) {
    try {
      await initializeAllEmployeesBalances();
    } catch (e) {
      console.error("[user-actions] bulk auto-init leave balances failed:", e);
    }
  }

  revalidatePath("/dashboard/hr/users");

  return result;
}
