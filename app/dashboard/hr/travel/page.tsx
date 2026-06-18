import { Suspense } from "react";
import { getTravelRequestsForFiscalYear } from "@/lib/actions/travel-actions";
import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { getEffectiveDeanSignerIds } from "@/lib/actions/approver-actions";
import { currentFiscalYear, getFiscalYearOptions } from "@/lib/date-ranges";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/supabase/cached-user";
import { loadDocRefInfo } from "@/lib/document-ref-info";
import { TravelDashboardClient } from "./travel-dashboard-client";
import HrTravelLoading from "./loading";

export const metadata = { title: "จัดการเดินทางราชการ" };

const ROLE_STAGE: Record<string, { status: string; label: string }> = {
  director: { status: "awaiting_director", label: "ผอ.สำนักงาน" },
  dean: { status: "awaiting_dean", label: "คณบดี" },
};

const IN_PROGRESS_STATUSES = [
  "pending",
  "awaiting_director",
  "awaiting_dean",
  "approved",
  "awaiting_university",
];

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
    .from("travel_requests")
    .select("id", { count: "exact", head: true })
    .in("status", statuses as ("awaiting_director" | "awaiting_dean")[]);

  return { labels: stages.map((s) => s.label), count: count ?? 0, statuses };
}

// Renders instantly — browser receives skeleton HTML in ~50ms
export default function TravelHubPage() {
  return (
    <Suspense fallback={<HrTravelLoading />}>
      <TravelHubContent />
    </Suspense>
  );
}

// All data-fetching happens here — streams in when ready (~400ms warm)
async function TravelHubContent() {
  const fy = currentFiscalYear();
  const supabase = await createClient();
  const user = await getCachedUser();

  const [profileResult, initialRequests, documents, myQueue] = await Promise.all([
    (user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null })) as Promise<{ data: { role: string } | null }>,
    getTravelRequestsForFiscalYear(fy),
    getAllDocumentTracking({ family: "travel" }),
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
