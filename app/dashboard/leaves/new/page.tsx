import { getLeaveTypes, getEmployeesForSelection } from "@/lib/actions/leave-actions";
import { LeaveRequestForm } from "./leave-request-form";

export const metadata = { title: "ยื่นคำขอลา" };

export default async function NewLeavePage() {
  const leaveTypes = await getLeaveTypes();

  let employees: { id: string; full_name: string; email: string }[] = [];
  try {
    employees = await getEmployeesForSelection();
  } catch {
    // Non-HR users won't have access — that's expected
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ยื่นคำขอลา</h1>
        <p className="text-muted-foreground">เลือกประเภทการลาและกรอกข้อมูลให้ครบถ้วน</p>
      </div>

      <div className="border rounded-xl p-6 bg-card shadow-sm">
        <LeaveRequestForm leaveTypes={leaveTypes} employees={employees} />
      </div>
    </div>
  );
}
