import { getTravelRequestsForFiscalYear } from "@/lib/actions/travel-actions";
import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { getEffectiveDeanSignerIds } from "@/lib/actions/approver-actions";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { createClient } from "@/lib/supabase/server";
import { loadDocRefInfo } from "@/lib/document-ref-info";
import { TravelDashboardClient } from "./travel-dashboard-client";

export const metadata = { title: "จัดการเดินทางราชการ" };

/** Stage a designated approver signs, keyed by approver role (no chair for travel). */
const ROLE_STAGE: Record<string, { status: string; label: string }> = {
  director: { status: "awaiting_director", label: "ผอ.สำนักงาน" },
  dean: { status: "awaiting_dean", label: "คณบดี" },
};

/** Resolve which signature stages the viewer can sign + how many wait. */
async function resolveMyQueue() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const roles = new Set<string>();
  const { data: assigned } = await supabase
    .from("workflow_approvers").select("approver_role").eq("user_id", user.id);
  for (const r of assigned ?? []) roles.add(r.approver_role as string);

  const deanToday = await getEffectiveDeanSignerIds(new Date().toISOString().slice(0, 10));
  if (deanToday.includes(user.id)) roles.add("dean");

  const stages = [...roles].map((r) => ROLE_STAGE[r]).filter(Boolean);
  if (stages.length === 0) return null;

  const statuses = stages.map((s) => s.status);
  const { count } = await supabase
    .from("travel_requests")
    .select("id", { count: "exact", head: true })
    .in("status", statuses as ("awaiting_director" | "awaiting_dean")[]);

  return { labels: stages.map((s) => s.label), count: count ?? 0, statuses };
}

/**
 * Every still-moving status (not completed/rejected/cancelled). HR/Admin see
 * all of these in "รอดำเนินการ" — including stages they don't sign — so no
 * unfinished request slips through; they follow up / chase the pending signer.
 */
const IN_PROGRESS_STATUSES = [
  "pending",
  "awaiting_director",
  "awaiting_dean",
  "approved",
  "awaiting_university",
];

export default async function TravelHubPage() {
  const fy = currentFiscalYear();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const role = profile?.role ?? "employee";

  const [initialRequests, documents, myQueue] = await Promise.all([
    getTravelRequestsForFiscalYear(fy),
    getAllDocumentTracking({ family: "travel" }),
    resolveMyQueue(),
  ]);

  const docRefInfo = await loadDocRefInfo(supabase, documents);

  // "รอดำเนินการ" tab scope: HR/Admin track every unfinished request (to
  // follow up), while a pure signer sees only the stages they must sign.
  const actionStatuses = Array.from(
    new Set([
      ...(role === "hr" || role === "admin" ? IN_PROGRESS_STATUSES : []),
      ...(myQueue?.statuses ?? []),
    ]),
  );

  return (
    <TravelDashboardClient
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
