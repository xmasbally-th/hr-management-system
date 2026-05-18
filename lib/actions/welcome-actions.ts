"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit-log";

/**
 * Server actions for the /welcome onboarding gate (Phase P-Onboard).
 *
 * Three states a user might be in when they hit /welcome:
 *   - awaiting_confirmation → showed profile, choose [accurate] or [incorrect]
 *   - awaiting_correction   → already submitted a correction request, can
 *                             cancel to make a new one
 *   - approved (re-visit)   → not normally routed here; redirect handled at page
 */

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
  if (profile.status !== "awaiting_confirmation") {
    throw new Error("สถานะบัญชีไม่อยู่ในขั้นตอนยืนยัน");
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
    throw new Error("บันทึกการยืนยันไม่สำเร็จ");
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
  if (profile.status !== "awaiting_confirmation") {
    throw new Error("สถานะบัญชีไม่อยู่ในขั้นตอนยืนยัน");
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
    throw new Error("ส่งคำขอแก้ไขไม่สำเร็จ");
  }

  // Move user to awaiting_correction state
  const now = new Date().toISOString();
  const { error: statusError } = await supabase
    .from("profiles")
    .update({
      status: "awaiting_correction",
      updated_at: now,
    })
    .eq("id", user.id);

  if (statusError) {
    console.error(
      "[welcome-actions] failed to set awaiting_correction:",
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

  // If this was a first_review correction, move user back to
  // awaiting_confirmation so they can re-review and (optionally) re-submit.
  if (cr.scope === "first_review") {
    await supabase
      .from("profiles")
      .update({ status: "awaiting_confirmation", updated_at: now })
      .eq("id", user.id);
  }

  await logAudit(
    supabase,
    user.id,
    "cancel_correction_request",
    "profile_correction_requests",
    id,
    {},
  );

  revalidatePath("/welcome");
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
