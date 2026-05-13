import Link from "next/link";
import { notFound } from "next/navigation";
import { getTravelRequestById } from "@/lib/actions/travel-actions";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { TravelDetailActions } from "./travel-detail-actions";
import { TravelExpensesTable } from "./travel-expenses-table";

export const metadata = { title: "รายละเอียดการเดินทางราชการ" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
  rejected: { label: "ไม่อนุมัติ", variant: "destructive" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
  completed: { label: "เสร็จสิ้น", variant: "default" },
};

const travelTypeLabels: Record<string, string> = {
  training: "อบรม/สัมมนา",
  supervision: "นิเทศนักศึกษา",
  official_contact: "ติดต่อราชการ",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TravelDetailPage({ params }: PageProps) {
  const { id } = await params;

  let travel: Awaited<ReturnType<typeof getTravelRequestById>>;
  try {
    travel = await getTravelRequestById(id);
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isOwner = travel.employee_id === user!.id;
  const isApprover = profile && ["hr", "admin", "manager"].includes(profile.role);
  const isHr = profile && ["hr", "admin"].includes(profile.role);

  const status = statusMap[travel.status] ?? { label: travel.status, variant: "outline" as const };

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

      {/* Actions */}
      <TravelDetailActions
        requestId={travel.id}
        status={travel.status}
        isOwner={isOwner}
        isApprover={Boolean(isApprover)}
        isHr={Boolean(isHr)}
        employeeName={t.employee?.full_name ?? ""}
        scannedDocumentPath={travel.order_document_url ?? null}
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
