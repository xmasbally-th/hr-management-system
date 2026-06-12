import { getAllDocumentTracking } from "@/lib/actions/document-actions";
import { createClient } from "@/lib/supabase/server";
import { HrDocumentsClient, type DocRefInfo } from "./hr-documents-client";

export const metadata = { title: "ติดตามเอกสาร (HR)" };

export default async function HrDocumentsPage() {
  const documents = await getAllDocumentTracking();

  // Enrich reference_id → employee name + leave/travel info so the queue
  // displays readable rows instead of raw UUID prefixes (W8).
  const refInfo = await loadRefInfo(documents);

  // Manager gets the same merged view read-only (replaces the former
  // /dashboard/approvals/documents page); hr/admin can edit.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const readOnly = profile?.role === "manager";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ติดตามเอกสาร</h1>
        <p className="text-muted-foreground">
          สถานะเส้นทางลงนามทั้งองค์กร + บันทึกงานกระดาษ (ส่งลงนาม, รับคืน, สแกน, ส่งหน่วยงาน)
        </p>
      </div>

      <HrDocumentsClient documents={documents} refInfo={refInfo} readOnly={readOnly} />
    </div>
  );
}

async function loadRefInfo(
  docs: Awaited<ReturnType<typeof getAllDocumentTracking>>,
): Promise<Record<string, DocRefInfo>> {
  const leaveIds = docs
    .filter((d) => d.document_type === "leave" || d.document_type === "leave_request")
    .map((d) => d.reference_id);
  const travelIds = docs
    .filter((d) => d.document_type === "travel_order" || d.document_type === "travel_claim")
    .map((d) => d.reference_id);
  const cancellationIds = docs
    .filter((d) => d.document_type === "leave_cancellation")
    .map((d) => d.reference_id);

  const supabase = await createClient();
  const [leavesRes, travelsRes, cancellationsRes] = await Promise.all([
    leaveIds.length
      ? supabase
          .from("leave_requests")
          .select(
            "id, start_date, end_date, leave_type:leave_types(name), employee:profiles!leave_requests_employee_id_fkey(full_name)",
          )
          .in("id", leaveIds)
      : Promise.resolve({ data: [] as unknown[] }),
    travelIds.length
      ? supabase
          .from("travel_requests")
          .select(
            "id, start_date, end_date, employee:profiles!travel_requests_employee_id_fkey(full_name)",
          )
          .in("id", travelIds)
      : Promise.resolve({ data: [] as unknown[] }),
    cancellationIds.length
      ? supabase
          .from("leave_cancellation_requests")
          .select(
            "id, cancel_start_date, cancel_end_date, leave_request:leave_requests(start_date, end_date, leave_type:leave_types(name), employee:profiles!leave_requests_employee_id_fkey(full_name))",
          )
          .in("id", cancellationIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const out: Record<string, DocRefInfo> = {};
  for (const raw of leavesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const l = raw as any;
    out[l.id] = {
      employeeName: l.employee?.full_name ?? "",
      typeName: l.leave_type?.name ?? "",
      startDate: l.start_date ?? null,
      endDate: l.end_date ?? null,
    };
  }
  for (const raw of travelsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = raw as any;
    out[t.id] = {
      employeeName: t.employee?.full_name ?? "",
      typeName: "",
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
    };
  }
  for (const raw of cancellationsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = raw as any;
    out[c.id] = {
      employeeName: c.leave_request?.employee?.full_name ?? "",
      typeName: c.leave_request?.leave_type?.name ?? "",
      // Partial cancellations carry their own range; fall back to the
      // original leave dates when the whole request is cancelled.
      startDate: c.cancel_start_date ?? c.leave_request?.start_date ?? null,
      endDate: c.cancel_end_date ?? c.leave_request?.end_date ?? null,
    };
  }
  return out;
}
