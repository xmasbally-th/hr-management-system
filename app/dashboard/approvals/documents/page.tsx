import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { FileText, ChevronRight } from "lucide-react";
import { DocumentWorkflowTimeline } from "@/components/document-workflow-timeline";

export const metadata = { title: "ติดตามเอกสาร (ทั้งองค์กร)" };

const docTypeLabels: Record<string, string> = {
  leave: "ใบลา",
  leave_request: "ใบลา",
  leave_cancellation: "คำขอยกเลิกใบลา",
  travel_order: "คำสั่งเดินทาง",
  travel_claim: "เบิกค่าเดินทาง",
};

function detailHref(docType: string, refId: string): string | null {
  if (docType === "leave" || docType === "leave_request") return `/dashboard/leaves/${refId}`;
  if (docType === "travel_order" || docType === "travel_claim") return `/dashboard/travel/${refId}`;
  return null;
}

export default async function ApprovalsDocumentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "hr", "manager"].includes(profile.role)) {
    redirect("/dashboard");
  }

  // Manager+ can read all document_tracking via RLS
  const { data: documents } = await supabase
    .from("document_tracking")
    .select("*")
    .is("deleted_at", null)
    .order("sent_to_director_date", { ascending: false, nullsFirst: false })
    .limit(100);

  const rows = documents ?? [];

  // Enrich reference_id → employee + leave/travel info (W8)
  const leaveIds = rows
    .filter((d) => d.document_type === "leave" || d.document_type === "leave_request")
    .map((d) => d.reference_id);
  const travelIds = rows
    .filter((d) => d.document_type === "travel_order" || d.document_type === "travel_claim")
    .map((d) => d.reference_id);
  const [leavesRes, travelsRes] = await Promise.all([
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
  ]);
  const refInfo: Record<string, { employeeName: string; typeName: string; startDate: string | null; endDate: string | null }> = {};
  for (const raw of leavesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const l = raw as any;
    refInfo[l.id] = {
      employeeName: l.employee?.full_name ?? "",
      typeName: l.leave_type?.name ?? "",
      startDate: l.start_date ?? null,
      endDate: l.end_date ?? null,
    };
  }
  for (const raw of travelsRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = raw as any;
    refInfo[t.id] = {
      employeeName: t.employee?.full_name ?? "",
      typeName: "",
      startDate: t.start_date ?? null,
      endDate: t.end_date ?? null,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ติดตามเอกสาร (ทั้งองค์กร)</h1>
        <p className="text-muted-foreground">เส้นทางเอกสารใบลา/เดินทาง อ่านอย่างเดียว · แก้ไขโดย HR/Admin ในหน้าจัดการ</p>
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg bg-card py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">ยังไม่มีเอกสารในระบบ</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((doc) => {
            const href = detailHref(doc.document_type, doc.reference_id);
            const label = docTypeLabels[doc.document_type] ?? doc.document_type;
            return (
              <div key={doc.id} className="border rounded-lg p-4 bg-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="shrink-0">{label}</Badge>
                    {refInfo[doc.reference_id] ? (
                      <div className="text-sm min-w-0">
                        <p className="truncate font-medium">
                          {refInfo[doc.reference_id].employeeName || "—"}
                          {refInfo[doc.reference_id].typeName ? ` · ${refInfo[doc.reference_id].typeName}` : ""}
                        </p>
                        {refInfo[doc.reference_id].startDate && refInfo[doc.reference_id].endDate && (
                          <p className="text-xs text-muted-foreground">
                            {refInfo[doc.reference_id].startDate} ~ {refInfo[doc.reference_id].endDate}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {doc.reference_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                  {href && (
                    <Link
                      href={href}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                    >
                      ดูรายละเอียด <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                {doc.notes && <p className="text-xs text-muted-foreground">{doc.notes}</p>}
                <DocumentWorkflowTimeline tracking={doc} docType={doc.document_type} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
