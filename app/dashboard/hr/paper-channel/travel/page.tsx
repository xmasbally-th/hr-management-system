import type { Metadata } from "next";
import { getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { getExamPeriods } from "@/lib/actions/exam-period-actions";
import { getExamDutyPositions } from "@/lib/actions/settings-actions";
import { currentFiscalYear } from "@/lib/date-ranges";
import { PaperTravelForm } from "./paper-travel-form";

export const metadata: Metadata = { title: "บันทึกคำขอเดินทาง (กระดาษ)" };

export default async function PaperTravelPage() {
  const curFy = currentFiscalYear();
  const [employees, examThisFy, examNextFy, dutyPositions] = await Promise.all([
    getEmployeesForSelection(),
    getExamPeriods(curFy).catch(() => []),
    getExamPeriods(curFy + 1).catch(() => []),
    getExamDutyPositions().catch(() => []),
  ]);
  const examPeriods = [...examThisFy, ...examNextFy];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บันทึกคำขอเดินทางแทนพนักงาน</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลจากแบบฟอร์มเดินทางราชการที่พนักงานยื่นเป็นกระดาษ
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <PaperTravelForm
          employees={employees}
          examPeriods={examPeriods}
          dutyPositions={dutyPositions}
        />
      </div>
    </div>
  );
}
