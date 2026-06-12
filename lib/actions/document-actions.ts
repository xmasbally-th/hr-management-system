"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";
import { createNotificationInternal } from "./notification-actions";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/** Human-readable label per paper-channel stamp column. */
const STAMP_LABELS: Record<string, string> = {
  sent_for_signature_date: "ส่งเอกสารไปลงนาม",
  returned_date: "รับเอกสารคืนแล้ว",
  scanned_upload_date: "สแกนและอัปโหลดเอกสารแล้ว",
  sent_to_agency_date: "ส่งเอกสารถึงหน่วยงานแล้ว",
};

/**
 * After a manual paper-channel stamp, record an audit entry and notify the
 * document owner. Best-effort: failures here never break the stamp itself
 * (audit/notify are fire-and-forget, matching logAudit's contract).
 */
async function auditAndNotifyStamp(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  docId: string,
  field: keyof typeof STAMP_LABELS,
) {
  const { data: track } = await supabase
    .from("document_tracking")
    .select("reference_id, document_type")
    .eq("id", docId)
    .single();
  if (!track) return;

  await logAudit(supabase, actorId, `stamp_${field}`, "document_tracking", docId, {
    document_type: track.document_type,
    reference_id: track.reference_id,
  });

  // Resolve the owning employee from the referenced request.
  let employeeId: string | null = null;
  let isTravel = false;
  if (track.document_type === "leave" || track.document_type === "leave_request") {
    const { data } = await supabase
      .from("leave_requests").select("employee_id").eq("id", track.reference_id).single();
    employeeId = data?.employee_id ?? null;
  } else if (track.document_type === "leave_cancellation") {
    const { data } = await supabase
      .from("leave_cancellation_requests")
      .select("leave_request:leave_requests(employee_id)")
      .eq("id", track.reference_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employeeId = (data as any)?.leave_request?.employee_id ?? null;
  } else if (
    track.document_type === "travel_order" ||
    track.document_type === "travel_claim" ||
    track.document_type === "travel_cancellation"
  ) {
    isTravel = true;
    const { data } = await supabase
      .from("travel_requests").select("employee_id").eq("id", track.reference_id).single();
    employeeId = data?.employee_id ?? null;
  }

  if (!employeeId) return;
  const label = STAMP_LABELS[field] ?? "อัปเดตสถานะเอกสาร";
  await createNotificationInternal(
    supabase,
    employeeId,
    isTravel ? "travel_status_update" : "leave_status_update",
    `เอกสารของคุณ: ${label}`,
  );
}

async function checkHrAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || (profile.role !== "hr" && profile.role !== "admin")) {
    throw new Error("Forbidden: Insufficient permissions");
  }
}

export async function getAllDocumentTracking() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  // Manager may read the org-wide queue (merged from /approvals/documents);
  // all mutations below remain hr/admin-only.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["hr", "admin", "manager"].includes(profile.role)) {
    throw new Error("Forbidden: Insufficient permissions");
  }

  const { data, error } = await supabase
    .from("document_tracking")
    .select("*")
    .is("deleted_at", null)
    .order("sent_for_signature_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลเอกสารได้");
  return data;
}

export async function getMyDocuments() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const [leaveRes, travelRes] = await Promise.all([
    supabase.from("leave_requests").select("id").eq("employee_id", user.id),
    supabase.from("travel_requests").select("id").eq("employee_id", user.id),
  ]);

  const myRefIds = [
    ...(leaveRes.data ?? []).map((r) => r.id),
    ...(travelRes.data ?? []).map((r) => r.id),
  ];

  if (myRefIds.length === 0) return [];

  const { data, error } = await supabase
    .from("document_tracking")
    .select("*")
    .in("reference_id", myRefIds)
    .is("deleted_at", null)
    .order("sent_for_signature_date", { ascending: false, nullsFirst: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลเอกสารได้");
  return data;
}

export async function getDocumentsByReference(referenceId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Manager + above can read any tracking row (matches the
  // "manager+ read all" RLS policy on document_tracking).
  const canReadAll =
    profile?.role === "hr" || profile?.role === "admin" || profile?.role === "manager";

  if (!canReadAll) {
    const [leaveRes, travelRes] = await Promise.all([
      supabase.from("leave_requests").select("id").eq("id", referenceId).eq("employee_id", user.id),
      supabase.from("travel_requests").select("id").eq("id", referenceId).eq("employee_id", user.id),
    ]);
    const owns = (leaveRes.data?.length ?? 0) > 0 || (travelRes.data?.length ?? 0) > 0;
    if (!owns) throw new Error("Forbidden: ไม่มีสิทธิ์ดูเอกสารนี้");
  }

  const { data, error } = await supabase
    .from("document_tracking")
    .select("*")
    .eq("reference_id", referenceId)
    .is("deleted_at", null)
    .order("sent_for_signature_date", { ascending: false });

  if (error) throw new Error("ไม่สามารถดึงข้อมูลเอกสารได้");
  return data;
}

export interface CreateDocumentTrackingInput {
  reference_id: string;
  document_type: string;
  notes?: string | null;
}

export async function createDocumentTracking(input: CreateDocumentTrackingInput) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .insert({
      reference_id: input.reference_id,
      document_type: input.document_type,
      notes: input.notes ?? null,
    });

  if (error) {
    console.error("[document-actions] Create failed:", error);
    throw new Error("ไม่สามารถสร้างรายการติดตามเอกสารได้");
  }

  revalidatePath("/dashboard/hr/documents");
}

export async function updateSentForSignature(docId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .update({ sent_for_signature_date: new Date().toISOString() })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถบันทึกวันที่ส่งลงนามได้");
  await auditAndNotifyStamp(supabase, user.id, docId, "sent_for_signature_date");
  revalidatePath("/dashboard/hr/documents");
}

export async function updateReturnedDate(docId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .update({ returned_date: new Date().toISOString() })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถบันทึกวันที่รับคืนได้");
  await auditAndNotifyStamp(supabase, user.id, docId, "returned_date");
  revalidatePath("/dashboard/hr/documents");
}

export async function updateScannedDate(docId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .update({ scanned_upload_date: new Date().toISOString() })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถบันทึกวันที่สแกนได้");
  await auditAndNotifyStamp(supabase, user.id, docId, "scanned_upload_date");
  revalidatePath("/dashboard/hr/documents");
}

export async function updateSentToAgency(docId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .update({ sent_to_agency_date: new Date().toISOString() })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถบันทึกวันที่ส่งหน่วยงานได้");
  await auditAndNotifyStamp(supabase, user.id, docId, "sent_to_agency_date");
  revalidatePath("/dashboard/hr/documents");
}

export async function updateDocumentNotes(docId: string, notes: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  const { error } = await supabase
    .from("document_tracking")
    .update({ notes })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถบันทึกหมายเหตุได้");
  revalidatePath("/dashboard/hr/documents");
}

export async function deleteDocumentTracking(docId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkHrAdmin(supabase, user.id);

  // Soft-delete (W9): stamp deleted_at instead of removing the row.
  // Read paths filter `deleted_at IS NULL` so the row disappears from UI.
  const { error } = await supabase
    .from("document_tracking")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", docId)
    .is("deleted_at", null);

  if (error) throw new Error("ไม่สามารถลบรายการเอกสารได้");
  await logAudit(supabase, user.id, "soft_delete_document_tracking", "document_tracking", docId, {});
  revalidatePath("/dashboard/hr/documents");
}
