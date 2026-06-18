import { Suspense } from "react";
import TravelDetailLoading from "./loading";
import { getCachedUser } from "@/lib/supabase/cached-user";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTravelRequestById } from "@/lib/actions/travel-actions";
import { getDocumentsByReference } from "@/lib/actions/document-actions";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { TravelDetailActions } from "./travel-detail-actions";
import { TravelExpensesTable } from "./travel-expenses-table";
import { TravelWorkflowPanel } from "./travel-workflow-panel";
import { CancellationWorkflowPanel } from "./cancellation-workflow-panel";
import { DocumentWorkflowTimeline } from "@/components/document-workflow-timeline";
import { TravelWorkflowStepper } from "@/components/travel-workflow-stepper";

export const metadata = { title: "รายละเอียดการเดินทางราชการ" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รอตรวจสอบ", variant: "secondary" },
  awaiting_director: { label: "รอผอ.สำนักงานลงนาม", variant: "secondary" },
  awaiting_dean: { label: "รอคณบดีลงนาม", variant: "secondary" },
  approved: { label: "อนุมัติ (คณบดีลงนาม)", variant: "default" },
  awaiting_university: { label: "ส่งมหาวิทยาลัย — รออธิการบดี", variant: "secondary" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
};

const travelTypeLabels: Record<string, string> = {
  training: "อบรม/สัมมนา",
  supervision: "นิเทศนักศึกษา",
  official_contact: "ติดต่อราชการ",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TravelDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<TravelDetailLoading />}>
      <TravelDetailContent params={params} />
    </Suspense>
  );
}

async function TravelDetailContent({ params }: PageProps) {
  const { id } = await params;

  let travel: Awaited<ReturnType<typeof getTravelRequestById>>;
  try {
    travel = await getTravelRequestById(id);
  } catch {
    notFound();
  }

  const user = await getCachedUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isOwner = travel.employee_id === user!.id;
  const isApprover = profile && ["hr", "admin", "manager"].includes(profile.role);
  const isHr = profile && ["hr", "admin"].includes(profile.role);

  const status = statusMap[travel.status] ?? { label: travel.status, variant: "outline" as const };

  // D5: document_tracking + latest cancellation (mirrors leaves/[id]/page.tsx)
  let tracking: Awaited<ReturnType<typeof getDocumentsByReference>>[number] | null = null;
  let cancellation: { id: string; status: string; reason: string } | null = null;
  let cancellationTracking: Awaited<ReturnType<typeof getDocumentsByReference>>[number] | null = null;
  try {
    const docs = await getDocumentsByReference(travel.id);
    tracking = docs.find((d) => d.document_type === "travel") ?? null;
  } catch {
    tracking = null;
  }

  const canSeeCancellation = isHr || isOwner || profile?.role === "manager";
  if (canSeeCancellation) {
    const { data: cancel } = await supabase
      .from("travel_cancellation_requests")
      .select("id, status, reason")
      .eq("travel_request_id", travel.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cancel) {
      cancellation = cancel;
      try {
        const cancelDocs = await getDocumentsByReference(cancel.id);
        cancellationTracking = cancelDocs.find((d) => d.document_type === "travel_cancellation") ?? cancelDocs[0] ?? null;
      } catch {
        cancellationTracking = null;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = travel as any;
  const expenses: Array<{
    id: string;
    expense_category: string;
    estimated_amount: number;
    actual_amount: number | null;
  }> = Array.isArray(t.expenses) ? t.expenses : [];

  const totalEstimated = expenses.reduce((sum, e) => sum + Number(e.estimated_amount ?? 0), 0);
  const totalActual = expenses.reduce((sum, e) => sum + Number(e.actual_amount ?? 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={isOwner ? "/dashboard/travel" : "/dashboard/hr/travel"}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปยังรายการ
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{travel.title}</h1>
          <p className="text-muted-foreground">{travelTypeLabels[travel.travel_type] ?? travel.travel_type}</p>
        </div>
        <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
      </div>

      {/* Workflow stepper (ยื่น → ผอ.สำนักงาน → คณบดี → อธิการบดี → เสร็จสิ้น) */}
      <TravelWorkflowStepper status={travel.status} />

      {/* Basic info */}
      <div className="border rounded-lg bg-card divide-y">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          <Field label="ผู้ขอเดินทาง" value={t.employee?.full_name ?? "-"} />
          <Field label="ตำแหน่ง" value={t.employee?.position_title ?? "-"} />
          <Field label="สถานที่" value={travel.location} />
          <Field label="ช่องทาง" value={travel.submission_channel === "paper" ? "กระดาษ" : "ดิจิทัล"} />
          <Field label="วันที่เริ่ม" value={travel.start_date} />
          <Field label="วันที่สิ้นสุด" value={travel.end_date} />
          <Field label="จำนวนวัน" value={`${travel.total_days} วัน`} />
          <Field label="ยื่นเมื่อ" value={new Date(travel.created_at).toLocaleString("th-TH")} />
        </div>

        {t.approver && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-1">ผู้พิจารณา</p>
            <p>{t.approver.full_name}</p>
          </div>
        )}
      </div>

      {/* Expenses (estimated vs actual) */}
      <div className="border rounded-lg bg-card overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-medium">รายการค่าใช้จ่าย</h2>
          <p className="text-xs text-muted-foreground mt-1">
            งบประมาณ: <span className="font-medium text-foreground">{totalEstimated.toLocaleString()} บาท</span>
            {totalActual > 0 && (
              <>
                {" • "}เบิกจริง: <span className="font-medium text-foreground">{totalActual.toLocaleString()} บาท</span>
              </>
            )}
          </p>
        </div>
        <TravelExpensesTable
          expenses={expenses}
          canEditActual={Boolean(isHr && ["approved", "completed"].includes(travel.status))}
        />
      </div>

      {/* HR/Admin workflow panel (ผอ. → คณบดี → อธิการบดี) */}
      {isHr && (
        <TravelWorkflowPanel
          requestId={travel.id}
          status={travel.status}
          tracking={tracking}
        />
      )}

      {/* Cancellation workflow (HR/Admin only when a cancellation exists) */}
      {isHr && cancellation && (
        <CancellationWorkflowPanel
          cancellationId={cancellation.id}
          status={cancellation.status}
          reason={cancellation.reason}
          tracking={cancellationTracking}
        />
      )}

      {/* Document timeline — visible to everyone who can see this travel request */}
      <div className="border rounded-lg p-4 bg-card">
        <p className="text-sm font-semibold mb-3">เส้นทางเอกสาร</p>
        <DocumentWorkflowTimeline tracking={tracking} docType="travel" />
      </div>

      {/* Cancellation timeline */}
      {cancellation && (
        <div className="border rounded-lg p-4 bg-amber-50/30">
          <p className="text-sm font-semibold mb-1">เส้นทางใบขอยกเลิก</p>
          {cancellation.reason && (
            <p className="text-xs text-muted-foreground mb-3">เหตุผล: {cancellation.reason}</p>
          )}
          <DocumentWorkflowTimeline tracking={cancellationTracking} docType="travel_cancellation" />
        </div>
      )}

      {/* Owner-side actions (cancel pending / request cancellation when completed / docx download) */}
      <TravelDetailActions
        requestId={travel.id}
        status={travel.status}
        isOwner={isOwner}
        isApprover={Boolean(isApprover)}
        isHr={Boolean(isHr)}
        employeeName={t.employee?.full_name ?? ""}
        scannedDocumentPath={travel.order_document_url ?? null}
        hasActiveCancellation={Boolean(cancellation && cancellation.status !== "rejected" && cancellation.status !== "cancelled")}
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
