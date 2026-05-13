import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaveRequestById } from "@/lib/actions/leave-actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { LeaveDetailActions } from "./leave-detail-actions";

export const metadata = { title: "รายละเอียดคำขอลา" };

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "รออนุมัติ", variant: "secondary" },
  approved: { label: "อนุมัติ", variant: "default" },
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
  const isApprover = profile && ["hr", "admin", "manager"].includes(profile.role);
  const status = statusMap[leave.status] ?? { label: leave.status, variant: "outline" as const };

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
          <Field label="จำนวนวัน" value={`${leave.total_days} วัน`} />
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
              <div>
                <p className="text-sm text-muted-foreground mb-1">ความเห็นหัวหน้าสาขา</p>
                <p className="whitespace-pre-wrap">{vacationDetails.branch_head_opinion}</p>
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

      {/* Actions (medical cert upload, approve/reject, cancel) */}
      <LeaveDetailActions
        requestId={leave.id}
        status={leave.status}
        isOwner={isOwner}
        isApprover={Boolean(isApprover)}
        isSick={isSick}
        employeeName={l.employee?.full_name ?? ""}
        existingMedicalCert={leave.medical_cert_url ?? null}
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
