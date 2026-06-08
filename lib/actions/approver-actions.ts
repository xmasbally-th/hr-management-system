"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit-log";

/**
 * Workflow approver designation + acting delegation (รักษาราชการแทน).
 *
 * - workflow_approvers: who is ประธานสาขาวิชา (chair, per department) /
 *   ผอ. (director) / คณบดี (dean). Chair is scoped per department; director
 *   and dean are single (faculty-wide).
 * - acting_delegations: a deputy who may sign in place of the dean during a
 *   date range.
 *
 * Writes are admin-only (also enforced by RLS). Reads of the resolved
 * approver for a given request/stage are used by the leave workflow.
 */

const UUID_RE = /^[0-9a-f-]{36}$/i;
export type ApproverRole = "chair" | "director" | "dean";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", userId).single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }
}

// ─── Read: full settings snapshot for the admin UI ─────────────────────

export interface ApproverAssignment {
  id: string;
  approver_role: ApproverRole;
  department_id: string | null;
  user: { id: string; full_name: string; email: string } | null;
  department: { id: string; name: string } | null;
}

export interface ActingDelegation {
  id: string;
  delegate_user_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  delegate: { id: string; full_name: string; email: string } | null;
}

export async function getApproverSettings(): Promise<{
  approvers: ApproverAssignment[];
  delegations: ActingDelegation[];
}> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const [{ data: approvers, error: aerr }, { data: delegations, error: derr }] =
    await Promise.all([
      supabase
        .from("workflow_approvers")
        .select(`
          id, approver_role, department_id,
          user:profiles!workflow_approvers_user_id_fkey(id, full_name, email),
          department:departments(id, name)
        `)
        .order("approver_role"),
      supabase
        .from("acting_delegations")
        .select(`
          id, delegate_user_id, start_date, end_date, note,
          delegate:profiles!acting_delegations_delegate_user_id_fkey(id, full_name, email)
        `)
        .order("start_date", { ascending: false }),
    ]);

  if (aerr) throw new Error("ไม่สามารถดึงข้อมูลผู้อนุมัติได้");
  if (derr) throw new Error("ไม่สามารถดึงข้อมูลรักษาราชการแทนได้");

  return {
    approvers: (approvers ?? []) as unknown as ApproverAssignment[],
    delegations: (delegations ?? []) as unknown as ActingDelegation[],
  };
}

// ─── Write: assign an approver (admin) ─────────────────────────────────

/**
 * Assign a user to an approver role. For director/dean (single, faculty-wide)
 * this replaces the current holder; for chair it replaces the chair of the
 * given department.
 */
export async function setApprover(input: {
  approverRole: ApproverRole;
  userId: string;
  departmentId?: string | null;
}) {
  const { approverRole, userId } = input;
  const departmentId = approverRole === "chair" ? input.departmentId ?? null : null;

  if (!UUID_RE.test(userId)) throw new Error("รหัสผู้ใช้ไม่ถูกต้อง");
  if (approverRole === "chair" && !departmentId) {
    throw new Error("ประธานสาขาวิชาต้องระบุสาขา/หน่วยงาน");
  }
  if (approverRole === "chair" && !UUID_RE.test(departmentId!)) {
    throw new Error("รหัสสาขา/หน่วยงานไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  // Replace the current holder of this slot (role, or role+department for chair)
  let del = supabase.from("workflow_approvers").delete().eq("approver_role", approverRole);
  del = approverRole === "chair" ? del.eq("department_id", departmentId!) : del.is("department_id", null);
  const { error: delErr } = await del;
  if (delErr) throw new Error("ไม่สามารถปรับปรุงผู้อนุมัติได้");

  const { error: insErr } = await supabase.from("workflow_approvers").insert({
    user_id: userId,
    approver_role: approverRole,
    department_id: departmentId,
  });
  if (insErr) {
    console.error("[approver-actions] setApprover insert failed:", insErr);
    throw new Error("ไม่สามารถบันทึกผู้อนุมัติได้");
  }

  await logAudit(supabase, user.id, "set_workflow_approver", "workflow_approver", userId, {
    approver_role: approverRole,
    department_id: departmentId,
  });
  revalidatePath("/dashboard/hr/master-data");
  return { success: true };
}

export async function removeApprover(id: string) {
  if (!UUID_RE.test(id)) throw new Error("รหัสไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const { error } = await supabase.from("workflow_approvers").delete().eq("id", id);
  if (error) throw new Error("ไม่สามารถลบผู้อนุมัติได้");
  await logAudit(supabase, user.id, "remove_workflow_approver", "workflow_approver", id);
  revalidatePath("/dashboard/hr/master-data");
  return { success: true };
}

// ─── Write: acting delegation (รักษาราชการแทนคณบดี) ────────────────────

export async function addActingDelegation(input: {
  delegateUserId: string;
  startDate: string;
  endDate: string;
  note?: string | null;
}) {
  const { delegateUserId, startDate, endDate } = input;
  if (!UUID_RE.test(delegateUserId)) throw new Error("รหัสผู้รักษาราชการแทนไม่ถูกต้อง");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new Error("รูปแบบวันที่ไม่ถูกต้อง");
  }
  if (endDate < startDate) throw new Error("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const { error } = await supabase.from("acting_delegations").insert({
    delegate_user_id: delegateUserId,
    approver_role: "dean",
    start_date: startDate,
    end_date: endDate,
    note: input.note?.trim() || null,
  });
  if (error) {
    console.error("[approver-actions] addActingDelegation failed:", error);
    throw new Error("ไม่สามารถบันทึกการรักษาราชการแทนได้");
  }
  await logAudit(supabase, user.id, "add_acting_delegation", "acting_delegation", delegateUserId, {
    start_date: startDate, end_date: endDate,
  });
  revalidatePath("/dashboard/hr/master-data");
  return { success: true };
}

export async function removeActingDelegation(id: string) {
  if (!UUID_RE.test(id)) throw new Error("รหัสไม่ถูกต้อง");
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  await checkAdmin(supabase, user.id);

  const { error } = await supabase.from("acting_delegations").delete().eq("id", id);
  if (error) throw new Error("ไม่สามารถลบการรักษาราชการแทนได้");
  await logAudit(supabase, user.id, "remove_acting_delegation", "acting_delegation", id);
  revalidatePath("/dashboard/hr/master-data");
  return { success: true };
}

// ─── Resolver: who is authorized for a given approval stage ────────────
// Used by the leave workflow (later phase). Uses the admin client caller's
// own session; reads are allowed to any authenticated user via RLS.

/** Chair user_id for a department, or null if none assigned. */
export async function getChairUserId(departmentId: string | null): Promise<string | null> {
  if (!departmentId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_approvers")
    .select("user_id")
    .eq("approver_role", "chair")
    .eq("department_id", departmentId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Director or dean user_id (single faculty-wide), or null. */
export async function getSingletonApproverUserId(role: "director" | "dean"): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_approvers")
    .select("user_id")
    .eq("approver_role", role)
    .is("department_id", null)
    .maybeSingle();
  return data?.user_id ?? null;
}

/**
 * User ids authorized to sign the DEAN stage on a given date: the dean plus
 * any deputy whose acting delegation covers that date (รักษาราชการแทน).
 */
export async function getEffectiveDeanSignerIds(onDateISO: string): Promise<string[]> {
  const supabase = await createClient();
  const ids = new Set<string>();
  const dean = await getSingletonApproverUserId("dean");
  if (dean) ids.add(dean);
  const { data } = await supabase
    .from("acting_delegations")
    .select("delegate_user_id")
    .eq("approver_role", "dean")
    .lte("start_date", onDateISO)
    .gte("end_date", onDateISO);
  for (const d of data ?? []) ids.add(d.delegate_user_id);
  return [...ids];
}
