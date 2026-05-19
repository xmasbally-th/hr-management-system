"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";
import { createNotificationInternal } from "./notification-actions";

/**
 * HR/Admin-side actions for managing profile correction requests
 * submitted by users via /welcome (first_review) or /dashboard/profile
 * (post_approval).
 *
 * The lifecycle of a request:
 *   pending → resolved (HR finished applying the change)
 *           → rejected (HR declined with reason)
 *           → cancelled (user withdrew)
 */

async function checkHrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: HR or admin role required");
  }
  return user.id;
}

export type CorrectionStatus = "pending" | "resolved" | "rejected" | "cancelled";
export type CorrectionScope = "first_review" | "post_approval";

export interface CorrectionListRow {
  id: string;
  target_user_id: string;
  target_user_name: string | null;
  target_user_email: string | null;
  target_user_department: string | null;
  submitted_by: string;
  reason_text: string;
  fields_flagged: string[];
  scope: CorrectionScope;
  status: CorrectionStatus;
  resolver_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface ListParams {
  status?: CorrectionStatus | "all";
  scope?: CorrectionScope | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  data: CorrectionListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  counts: {
    pending: number;
    resolved: number;
    rejected: number;
    cancelled: number;
  };
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Paginated, filterable list of correction requests with target-user info.
 */
export async function listProfileCorrections(
  params: ListParams = {},
): Promise<ListResult> {
  const supabase = await createClient();
  await checkHrAdmin(supabase);

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build the joined query — fetch target user info via FK
  let query = supabase
    .from("profile_correction_requests")
    .select(
      `id, target_user_id, submitted_by, reason_text, fields_flagged, scope,
       status, resolver_note, resolved_by, resolved_at, created_at,
       target:profiles!profile_correction_requests_target_user_id_fkey(
         full_name, email, department:departments(name)
       )`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }
  if (params.scope && params.scope !== "all") {
    query = query.eq("scope", params.scope);
  }
  // Note: searching by user fields requires a separate subquery; the
  // `target` join can't be filtered via .ilike() directly. For now we
  // filter client-side on full_name/email after fetching.

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) {
    console.error("[correction-actions] list failed:", error);
    throw new Error("ไม่สามารถดึงรายการคำขอได้: " + error.message);
  }

  // Stat counts (cheap — one query per status, totals across all rows)
  const [pending, resolved, rejected, cancelled] = await Promise.all([
    countByStatus(supabase, "pending"),
    countByStatus(supabase, "resolved"),
    countByStatus(supabase, "rejected"),
    countByStatus(supabase, "cancelled"),
  ]);

  // Map joined data into a flat list shape
  const search = params.search?.trim().toLowerCase() ?? "";
  // The join could return either an object or an array depending on the
  // SDK's inference — normalise to a single record.
  const normalised: CorrectionListRow[] = (data ?? []).map((r) => {
    const t = Array.isArray(r.target) ? r.target[0] : r.target;
    const dept = t && (Array.isArray(t.department) ? t.department[0] : t.department);
    return {
      id: r.id,
      target_user_id: r.target_user_id,
      target_user_name: t?.full_name ?? null,
      target_user_email: t?.email ?? null,
      target_user_department: dept?.name ?? null,
      submitted_by: r.submitted_by,
      reason_text: r.reason_text,
      fields_flagged: (r.fields_flagged as string[]) ?? [],
      scope: r.scope as CorrectionScope,
      status: r.status as CorrectionStatus,
      resolver_note: r.resolver_note,
      resolved_by: r.resolved_by,
      resolved_at: r.resolved_at,
      created_at: r.created_at,
    };
  });

  const filtered = search
    ? normalised.filter(
        (r) =>
          (r.target_user_name ?? "").toLowerCase().includes(search) ||
          (r.target_user_email ?? "").toLowerCase().includes(search),
      )
    : normalised;

  return {
    data: filtered,
    totalCount: count ?? filtered.length,
    page,
    pageSize,
    counts: { pending, resolved, rejected, cancelled },
  };
}

async function countByStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  status: CorrectionStatus,
): Promise<number> {
  const { count } = await supabase
    .from("profile_correction_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}

/**
 * Fetch a single correction request with target-user info — used to power
 * the review dialog.
 */
export async function getCorrectionRequest(id: string): Promise<CorrectionListRow | null> {
  const supabase = await createClient();
  await checkHrAdmin(supabase);

  const { data, error } = await supabase
    .from("profile_correction_requests")
    .select(
      `id, target_user_id, submitted_by, reason_text, fields_flagged, scope,
       status, resolver_note, resolved_by, resolved_at, created_at,
       target:profiles!profile_correction_requests_target_user_id_fkey(
         full_name, email, department:departments(name)
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[correction-actions] get failed:", error);
    return null;
  }
  if (!data) return null;

  const t = Array.isArray(data.target) ? data.target[0] : data.target;
  const dept = t && (Array.isArray(t.department) ? t.department[0] : t.department);
  return {
    id: data.id,
    target_user_id: data.target_user_id,
    target_user_name: t?.full_name ?? null,
    target_user_email: t?.email ?? null,
    target_user_department: dept?.name ?? null,
    submitted_by: data.submitted_by,
    reason_text: data.reason_text,
    fields_flagged: (data.fields_flagged as string[]) ?? [],
    scope: data.scope as CorrectionScope,
    status: data.status as CorrectionStatus,
    resolver_note: data.resolver_note,
    resolved_by: data.resolved_by,
    resolved_at: data.resolved_at,
    created_at: data.created_at,
  };
}

/**
 * Mark a correction as resolved — HR has applied the requested change.
 * Sets resolver fields + notifies the target user.
 */
export async function resolveCorrectionRequest(
  id: string,
  note?: string,
): Promise<void> {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);

  // Get target before update for the notification
  const { data: cr } = await supabase
    .from("profile_correction_requests")
    .select("target_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!cr) throw new Error("ไม่พบคำขอแก้ไข");
  if (cr.status !== "pending") {
    throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
  }

  const trimmedNote = note?.trim() ? note.trim() : null;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profile_correction_requests")
    .update({
      status: "resolved",
      resolver_note: trimmedNote,
      resolved_by: actorId,
      resolved_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("[correction-actions] resolve failed:", error);
    throw new Error("บันทึกผลไม่สำเร็จ: " + error.message);
  }

  await logAudit(
    supabase,
    actorId,
    "resolve_correction_request",
    "profile_correction_requests",
    id,
    { target: cr.target_user_id, has_note: !!trimmedNote },
  );

  // Notify the user — fire-and-forget
  try {
    await createNotificationInternal(
      supabase,
      cr.target_user_id,
      "correction_resolved",
      "ฝ่ายบุคคลดำเนินการแก้ไขข้อมูลตามคำขอของคุณเรียบร้อยแล้ว",
    );
  } catch {
    // ignore
  }

  revalidatePath("/dashboard/hr/profile-corrections");
  revalidatePath("/dashboard");
}

/**
 * Reject a correction request — HR declines with a required reason.
 * Notifies the target user with the reason text.
 */
export async function rejectCorrectionRequest(
  id: string,
  note: string,
): Promise<void> {
  const supabase = await createClient();
  const actorId = await checkHrAdmin(supabase);
  checkRateLimit(actorId);

  const trimmed = note?.trim() ?? "";
  if (trimmed.length < 5) {
    throw new Error("กรุณาระบุเหตุผลในการปฏิเสธอย่างน้อย 5 ตัวอักษร");
  }
  if (trimmed.length > 2000) {
    throw new Error("เหตุผลยาวเกินกำหนด (สูงสุด 2000 ตัวอักษร)");
  }

  const { data: cr } = await supabase
    .from("profile_correction_requests")
    .select("target_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!cr) throw new Error("ไม่พบคำขอแก้ไข");
  if (cr.status !== "pending") {
    throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profile_correction_requests")
    .update({
      status: "rejected",
      resolver_note: trimmed,
      resolved_by: actorId,
      resolved_at: now,
    })
    .eq("id", id);

  if (error) {
    console.error("[correction-actions] reject failed:", error);
    throw new Error("บันทึกผลไม่สำเร็จ: " + error.message);
  }

  await logAudit(
    supabase,
    actorId,
    "reject_correction_request",
    "profile_correction_requests",
    id,
    { target: cr.target_user_id },
  );

  try {
    await createNotificationInternal(
      supabase,
      cr.target_user_id,
      "correction_rejected",
      `คำขอแก้ไขข้อมูลของคุณไม่ได้รับการอนุมัติ — เหตุผล: ${trimmed}`,
    );
  } catch {
    // ignore
  }

  revalidatePath("/dashboard/hr/profile-corrections");
  revalidatePath("/dashboard");
}

/**
 * Light-weight pending count for nav badges / dashboard tiles.
 */
export async function getPendingCorrectionCount(): Promise<number> {
  const supabase = await createClient();
  try {
    await checkHrAdmin(supabase);
  } catch {
    return 0;
  }
  return countByStatus(supabase, "pending");
}
