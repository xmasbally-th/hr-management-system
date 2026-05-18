"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

/**
 * Server actions for the /welcome onboarding gate (Phase P-Onboard).
 *
 * Statuses considered "in onboarding" (any of these allows /welcome actions):
 *   - pre_registered, awaiting_confirmation, awaiting_correction, pending
 */

const ONBOARDING_STATUSES = new Set([
  "pre_registered",
  "awaiting_confirmation",
  "awaiting_correction",
  "pending",
]);

async function getAuthUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Mark profile as accurate — user confirmed the HR-imported data is correct.
 * Sets status='approved' and profile_completed_at=now().
 */
export async function confirmProfileAsAccurate(): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  // Guard: only valid from awaiting_confirmation
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("ไม่พบโปรไฟล์");
  if (!ONBOARDING_STATUSES.has(profile.status)) {
    throw new Error(`สถานะบัญชี (${profile.status}) ไม่อยู่ในขั้นตอนยืนยัน`);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      status: "approved",
      profile_completed_at: now,
      updated_at: now,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[welcome-actions] confirmProfileAsAccurate failed:", error);
    throw new Error("บันทึกการยืนยันไม่สำเร็จ: " + error.message);
  }

  await logAudit(supabase, user.id, "confirm_profile_accurate", "profile", user.id, {});

  revalidatePath("/welcome");
  revalidatePath("/dashboard");
}

export interface FirstReviewCorrectionInput {
  /** Field keys ที่ user flag ว่าผิด (เช่น ["phone","department_id"]) */
  fields_flagged: string[];
  /** ข้อความที่ user พิมพ์ระบุรายละเอียดที่ต้องแก้ */
  reason_text: string;
}

/**
 * Submit a first-review correction request — user says HR's imported data
 * is wrong. Sets status='awaiting_correction' so the proxy keeps them at
 * /welcome until HR resolves the request.
 */
export async function submitFirstReviewCorrection(
  input: FirstReviewCorrectionInput,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  const reason = (input.reason_text ?? "").trim();
  if (reason.length < 10) {
    throw new Error("กรุณาระบุรายละเอียดที่ต้องการแก้ไข (อย่างน้อย 10 ตัวอักษร)");
  }
  if (reason.length > 2000) {
    throw new Error("ข้อความยาวเกินกำหนด (สูงสุด 2000 ตัวอักษร)");
  }

  const fields = Array.isArray(input.fields_flagged) ? input.fields_flagged : [];

  // Guard: only valid from awaiting_confirmation
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("ไม่พบโปรไฟล์");
  if (!ONBOARDING_STATUSES.has(profile.status)) {
    throw new Error(`สถานะบัญชี (${profile.status}) ไม่อยู่ในขั้นตอนยืนยัน`);
  }

  // Insert correction request
  const { data: inserted, error: insertError } = await supabase
    .from("profile_correction_requests")
    .insert({
      target_user_id: user.id,
      submitted_by: user.id,
      reason_text: reason,
      fields_flagged: fields,
      proposed_payload: null,
      scope: "first_review",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error(
      "[welcome-actions] submitFirstReviewCorrection failed:",
      insertError,
    );
    throw new Error(
      "ส่งคำขอแก้ไขไม่สำเร็จ: " + (insertError?.message ?? "unknown"),
    );
  }

  // User has reviewed the data and noted required corrections — treat as
  // "approved for use". Pending correction request stays in queue for HR.
  const now = new Date().toISOString();
  const { error: statusError } = await supabase
    .from("profiles")
    .update({
      status: "approved",
      profile_completed_at: now,
      updated_at: now,
    })
    .eq("id", user.id);

  if (statusError) {
    console.error(
      "[welcome-actions] failed to set approved after correction:",
      statusError,
    );
    // Continue — the request is in DB; HR can still resolve it
  }

  await logAudit(
    supabase,
    user.id,
    "submit_correction_first_review",
    "profile_correction_requests",
    inserted.id,
    { fields_flagged: fields, reason_length: reason.length },
  );

  revalidatePath("/welcome");
  revalidatePath("/dashboard");
  return { id: inserted.id };
}

/**
 * Cancel a pending correction request — owner-only. After cancel, the user
 * goes back to awaiting_confirmation and can re-review.
 */
export async function cancelMyCorrectionRequest(id: string): Promise<void> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  checkRateLimit(user.id);

  if (!id || typeof id !== "string") throw new Error("รหัสคำขอไม่ถูกต้อง");

  // Verify ownership + pending status
  const { data: cr } = await supabase
    .from("profile_correction_requests")
    .select("id, target_user_id, status, scope")
    .eq("id", id)
    .single();

  if (!cr) throw new Error("ไม่พบคำขอ");
  if (cr.target_user_id !== user.id) throw new Error("ไม่มีสิทธิ์ยกเลิก");
  if (cr.status !== "pending") throw new Error("คำขอนี้ถูกดำเนินการแล้ว");

  const now = new Date().toISOString();
  const { error: cancelError } = await supabase
    .from("profile_correction_requests")
    .update({
      status: "cancelled",
      resolved_at: now,
      resolver_note: "ยกเลิกโดยผู้ใช้",
    })
    .eq("id", id);

  if (cancelError) {
    console.error("[welcome-actions] cancel failed:", cancelError);
    throw new Error("ยกเลิกคำขอไม่สำเร็จ");
  }

  // Note: we no longer revert profile.status — once a correction is
  // submitted the user is approved+can use the system. Cancelling the
  // request just removes HR's pending action item.

  await logAudit(
    supabase,
    user.id,
    "cancel_correction_request",
    "profile_correction_requests",
    id,
    {},
  );

  revalidatePath("/welcome");
  revalidatePath("/dashboard");
}

/**
 * List of pending correction requests submitted by the current user — for
 * showing the "HR is reviewing your changes" banner on /dashboard.
 */
export async function getMyPendingCorrections(): Promise<
  Array<{
    id: string;
    reason_text: string;
    fields_flagged: string[];
    scope: "first_review" | "post_approval";
    created_at: string;
  }>
> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("profile_correction_requests")
    .select("id, reason_text, fields_flagged, scope, created_at")
    .eq("target_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[welcome-actions] getMyPendingCorrections:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Get the user's most-recent pending correction request (if any) — for
 * showing in the /welcome "awaiting_correction" state.
 */
export async function getMyPendingFirstReviewCorrection() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data, error } = await supabase
    .from("profile_correction_requests")
    .select("id, reason_text, fields_flagged, created_at")
    .eq("target_user_id", user.id)
    .eq("scope", "first_review")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[welcome-actions] getMyPendingFirstReviewCorrection:", error);
    return null;
  }
  return data;
}
