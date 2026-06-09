import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaveRequestById } from "@/lib/actions/leave-actions";
import { getChairUserId, getSingletonApproverUserId, getEffectiveDeanSignerIds } from "@/lib/actions/approver-actions";
import { getDocumentsByReference } from "@/lib/actions/document-actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { LeaveDetailActions } from "./leave-detail-actions";
import { LeaveWorkflowPanel } from "./leave-workflow-panel";
import { CancellationWorkflowPanel } from "./cancellation-workflow-panel";
import { DocumentWorkflowTimeline } from "@/components/document-workflow-timeline";

export const metadata = { title: "รายละเอียดคำขอลา" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รอตรวจสอบ", variant: "secondary" },
  awaiting_chair: { label: "รอประธานสาขาให้ความเห็น", variant: "secondary" },
  awaiting_director: { label: "รอผู้อำนวยการลงนาม", variant: "secondary" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary" },
  approved: { label: "อนุมัติ (คณบดีลงนาม)", variant: "default" },
  awaiting_university: { label: "ส่งมหาวิทยาลัย — รออธิการบดี", variant: "secondary" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeaveDetailPage({ params }: PageProps) {
  const { id } = await params;

  let leave: Awaited<ReturnType<typeof getLeaveRequestById>>;
  try {
    leave = await getLeaveRequestById(id);
  } catch {
    notFound();
  }

  // Determine viewer role for showing approve/reject vs cancel
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isOwner = leave.employee_id === user!.id;
  const isHrAdmin = !!profile && ["hr", "admin"].includes(profile.role);
  const status = statusMap[leave.status] ?? { label: leave.status, variant: "outline" as const };

  // ── Designated-approver resolution (so ผอ./คณบดี/ประธานสาขา can act on
  //    their own stage, not only HR) ──
  const emp = leave.employee as { department_id?: string | null; employee_type?: string | null } | null;
  const isAcademic = !!emp?.employee_type?.includes("สายวิชาการ");
  const leaveTypeNameForChair = (leave.leave_type as { name?: string } | null)?.name ?? "";
  const isVacationLeave = /พักผ่อน|vacation/i.test(leaveTypeNameForChair);
  const needsChair = isVacationLeave && isAcademic;

  const viewerId = user!.id;
  const [chairId, directorId, deanSigners] = await Promise.all([
    needsChair ? getChairUserId(emp?.department_id ?? null) : Promise.resolve(null),
    getSingletonApproverUserId("director"),
    getEffectiveDeanSignerIds(new Date().toISOString().slice(0, 10)),
  ]);
  const canChair = needsChair && chairId === viewerId;
  const canDirector = directorId === viewerId;
  const canDean = deanSigners.includes(viewerId);
  const canActOnWorkflow = isHrAdmin || canChair || canDirector || canDean;

  // Document-tracking row (timeline shown to ALL viewers — owner/manager/HR)
  let tracking: Awaited<ReturnType<typeof getDocumentsByReference>>[number] | null = null;
  let cancellation: { id: string; status: string; reason: string } | null = null;
  let cancellationTracking: Awaited<ReturnType<typeof getDocumentsByReference>>[number] | null = null;
  try {
    const docs = await getDocumentsByReference(id);
    tracking = docs.find((d) => d.document_type === "leave") ?? docs[0] ?? null;
  } catch {
    tracking = null;
  }

  // Active (latest) cancellation request — managers + HR/admin can see; owner
  // can see only their own (RLS).
  const canSeeCancellation = isHrAdmin || isOwner || profile?.role === "manager";
  if (canSeeCancellation) {
    const { data: cancel } = await supabase
      .from("leave_cancellation_requests")
      .select("id, status, reason")
      .eq("leave_request_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cancel) {
      cancellation = cancel;
      try {
        const cancelDocs = await getDocumentsByReference(cancel.id);
        cancellationTracking = cancelDocs[0] ?? null;
      } catch {
        cancellationTracking = null;
      }
    }
  }

  // Type narrowing via cast — Supabase nested select returns dynamic shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l = leave as any;
  const leaveTypeName: string = l.leave_type?.name ?? "-";
  const typeLower = leaveTypeName.toLowerCase();
  const isSick = typeLower.includes("ป่วย") || typeLower.includes("sick");
  const isMaternity = typeLower.includes("คลอด") || typeLower.includes("maternity");
  const isVacation = typeLower.includes("พักผ่อน") || typeLower.includes("vacation");
  const vacationDetails = Array.isArray(l.vacation_details) ? l.vacation_details[0] : l.vacation_details;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={isOwner ? "/dashboard/leaves" : "/dashboard/hr/leaves"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปยังรายการ
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายละเอียดคำขอลา</h1>
          <p className="text-muted-foreground">{leaveTypeName}</p>
        </div>
        <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
      </div>

      {/* Basic info */}
      <div className="border rounded-lg bg-card divide-y">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          <Field label="ผู้ขอลา" value={l.employee?.full_name ?? "-"} />
          <Field label="ตำแหน่ง" value={l.employee?.position_title ?? "-"} />
          <Field label="วันที่เริ่ม" value={leave.start_date} />
          <Field label="วันที่สิ้นสุด" value={leave.end_date} />
          <Field
            label="จำนวนวัน"
            value={
              leave.working_days != null && leave.working_days !== leave.total_days
                ? `${leave.total_days} วันปฏิทิน (${leave.working_days} วันทำการ)`
                : `${leave.total_days} วัน`
            }
          />
          <Field label="ช่องทาง" value={leave.submission_channel === "paper" ? "กระดาษ" : "ดิจิทัล"} />
          <Field label="เบอร์ติดต่อ" value={leave.contact_number ?? "-"} />
          <Field label="ยื่นเมื่อ" value={new Date(leave.created_at).toLocaleString("th-TH")} />
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-1">เหตุผล</p>
          <p className="whitespace-pre-wrap">{leave.reason || "-"}</p>
        </div>

        {isMaternity && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-1">วันที่กำหนดคลอด</p>
            <p>{leave.expected_delivery_date ?? "-"}</p>
          </div>
        )}

        {isVacation && vacationDetails && (
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium">รายละเอียดการลาพักผ่อน</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="วันสะสม" value={`${vacationDetails.accumulated_days ?? 0} วัน`} />
              <Field label="วันประจำปี" value={`${vacationDetails.annual_days ?? 0} วัน`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">ผู้ปฏิบัติงานแทน</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>{vacationDetails.substitute_1?.full_name ?? "-"}</li>
                <li>{vacationDetails.substitute_2?.full_name ?? "-"}</li>
                <li>{vacationDetails.substitute_3?.full_name ?? "-"}</li>
              </ol>
            </div>
            {vacationDetails.branch_head_opinion && (
              <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                  ความเห็นประธานสาขาวิชา
                </p>
                <p className="whitespace-pre-wrap text-sm">{vacationDetails.branch_head_opinion}</p>
              </div>
            )}
          </div>
        )}

        {l.approver && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-1">ผู้พิจารณา</p>
            <p>{l.approver.full_name}</p>
          </div>
        )}
      </div>

      {/* HR/Admin signature workflow panel (ผอ. → คณบดี → อธิการบดี) */}
      {canActOnWorkflow && (
        <LeaveWorkflowPanel
          requestId={leave.id}
          status={leave.status}
          tracking={tracking}
          isHrAdmin={isHrAdmin}
          canChair={canChair}
          canDirector={canDirector}
          canDean={canDean}
          needsChair={needsChair}
          existingOpinion={vacationDetails?.branch_head_opinion ?? null}
        />
      )}

      {/* Cancellation request workflow (only for HR/Admin when one exists) */}
      {isHrAdmin && cancellation && (
        <CancellationWorkflowPanel
          cancellationId={cancellation.id}
          status={cancellation.status}
          reason={cancellation.reason}
          tracking={cancellationTracking}
        />
      )}

      {/* Document timeline — visible to everyone who can see this leave */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm font-semibold mb-3">เส้นทางเอกสาร</p>
        <DocumentWorkflowTimeline tracking={tracking} docType="leave" />
      </div>

      {/* Cancellation timeline — visible whenever a cancellation exists */}
      {cancellation && (
        <div className="border rounded-lg p-4 bg-amber-50/30">
          <p className="text-sm font-semibold mb-1">เส้นทางใบขอยกเลิก</p>
          {cancellation.reason && (
            <p className="text-xs text-muted-foreground mb-3">เหตุผล: {cancellation.reason}</p>
          )}
          <DocumentWorkflowTimeline tracking={cancellationTracking} docType="leave_cancellation" />
        </div>
      )}

      {/* Owner cancel / completed-cancellation request / medical cert / download */}
      <LeaveDetailActions
        requestId={leave.id}
        status={leave.status}
        isOwner={isOwner}
        isSick={isSick}
        existingMedicalCert={leave.medical_cert_url ?? null}
        canDownloadDoc={isHrAdmin}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
