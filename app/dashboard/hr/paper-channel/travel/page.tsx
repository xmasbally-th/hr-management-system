import type { Metadata } from "next";
import { getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { PaperTravelForm } from "./paper-travel-form";

export const metadata: Metadata = { title: "บันทึกคำขอเดินทาง (กระดาษ)" };

export default async function PaperTravelPage() {
  const employees = await getEmployeesForSelection();

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บันทึกคำขอเดินทางแทนพนักงาน</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลจากแบบฟอร์มเดินทางราชการที่พนักงานยื่นเป็นกระดาษ
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <PaperTravelForm employees={employees} />
      </div>
    </div>
  );
}
