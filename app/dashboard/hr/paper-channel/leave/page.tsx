import type { Metadata } from "next";
import { getLeaveTypes, getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { PaperLeaveForm } from "./paper-leave-form";

export const metadata: Metadata = { title: "บันทึกใบลา (กระดาษ)" };

export default async function PaperLeavePage() {
  const [leaveTypes, employees] = await Promise.all([
    getLeaveTypes(),
    getEmployeesForSelection(),
  ]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บันทึกใบลาแทนพนักงาน</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลจากใบลากระดาษที่พนักงานยื่น ระบบจะบันทึกเป็นช่องทาง &quot;กระดาษ&quot; โดยอัตโนมัติ
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <PaperLeaveForm leaveTypes={leaveTypes} employees={employees} />
      </div>
    </div>
  );
}
