import { Suspense } from "react";
import { getLeaveTypes, getLeaveRequestsForFiscalYear } from "@/lib/actions/leave-actions";
import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { getEffectiveDeanSignerIds } from "@/lib/actions/approver-actions";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { loadDocRefInfo } from "@/lib/document-ref-info";
import { LeavesDashboardClient } from "./leaves-dashboard-client";
import HrLeavesLoading from "./loading";

export const metadata = { title: "จัดการใบลา" };

const ROLE_STAGE: Record<string, { status: string; label: string }> = {
  chair: { status: "awaiting_chair", label: "ประธานสาขาวิชา" },
  director: { status: "awaiting_director", label: "ผอ.สำนักงาน" },
  dean: { status: "awaiting_dean", label: "คณบดี" },
};

const IN_PROGRESS_STATUSES = [
  "pending",
  "awaiting_chair",
  "awaiting_director",
  "awaiting_dean",
  "approved",
  "awaiting_university",
];

async function getActivePersonnel() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, position_title")
    .eq("status", "approved")
    .order("full_name");
  return data ?? [];
}

async function resolveMyQueue() {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return null;

  const roles = new Set<string>();

  const [{ data: assigned }, deanToday] = await Promise.all([
    supabase.from("workflow_approvers").select("approver_role").eq("user_id", user.id),
    getEffectiveDeanSignerIds(new Date().toISOString().slice(0, 10)),
  ]);

  for (const r of assigned ?? []) roles.add(r.approver_role as string);
  if (deanToday.includes(user.id)) roles.add("dean");

  const stages = [...roles].map((r) => ROLE_STAGE[r]).filter(Boolean);
  if (stages.length === 0) return null;

  const statuses = stages.map((s) => s.status);
  const { count } = await supabase
    .from("leave_requests")
    .select("id", { count: "exact", head: true })
    .in("status", statuses as ("awaiting_chair" | "awaiting_director" | "awaiting_dean")[]);

  return { labels: stages.map((s) => s.label), count: count ?? 0, statuses };
}

// Renders instantly — browser receives skeleton HTML in ~50ms
export default function LeaveHubPage() {
  return (
    <Suspense fallback={<HrLeavesLoading />}>
      <LeaveHubContent />
    </Suspense>
  );
}

// All data-fetching happens here — streams in when ready (~400ms warm)
async function LeaveHubContent() {
  const fy = currentFiscalYear();
  const supabase = await createClient();
  const user = await getCachedUser();

  const [profileResult, leaveTypes, personnel, initialRequests, documents, myQueue] = await Promise.all([
    (user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null })) as Promise<{ data: { role: string } | null }>,
    getLeaveTypes(),
    getActivePersonnel(),
    getLeaveRequestsForFiscalYear(fy),
    getAllDocumentTracking({ family: "leave" }),
    resolveMyQueue(),
  ]);
  const role = profileResult.data?.role ?? "employee";

  const docRefInfo = await loadDocRefInfo(supabase, documents);

  const actionStatuses = Array.from(
    new Set([
      ...(role === "hr" || role === "admin" ? IN_PROGRESS_STATUSES : []),
      ...(myQueue?.statuses ?? []),
    ]),
  );

  return (
    <LeavesDashboardClient
      leaveTypes={(leaveTypes ?? []).map((t) => ({ id: t.id, name: t.name, code: t.code }))}
      personnel={personnel}
      initialRequests={initialRequests}
      fiscalYearOptions={getFiscalYearOptions()}
      currentFiscalYear={fy}
      role={role}
      documents={documents}
      docRefInfo={docRefInfo}
      myQueue={myQueue}
      actionStatuses={actionStatuses}
    />
  );
}
