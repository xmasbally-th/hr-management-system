import type { createClient } from "@/lib/supabase/server";
import type { DocRefInfo } from "@/app/dashboard/hr/documents/hr-documents-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface TrackingRow {
  reference_id: string;
  document_type: string;
}

/**
 * Enrich document_tracking rows: reference_id → employee name + leave/travel
 * info, so queues display readable rows instead of raw UUID prefixes (W8).
 * Shared by the leave hub and the travel tracking page.
 */
export async function loadDocRefInfo(
  supabase: SupabaseServerClient,
  docs: TrackingRow[],
): Promise<Record<string, DocRefInfo>> {
  const leaveIds = docs
    .filter((d) => d.document_type === "leave" || d.document_type === "leave_request")
    .map((d) => d.reference_id);
  const travelIds = docs
    .filter(
      (d) =>
        d.document_type === "travel" ||
        d.document_type === "travel_order" ||
        d.document_type === "travel_claim" ||
        d.document_type === "travel_cancellation",
    )
    .map((d) => d.reference_id);
  const cancellationIds = docs
    .filter((d) => d.document_type === "leave_cancellation")
    .map((d) => d.reference_id);

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
