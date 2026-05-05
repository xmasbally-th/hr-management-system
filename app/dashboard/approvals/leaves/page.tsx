import { getAllLeaveRequests } from "@/lib/actions/leave-actions";
import { HrLeavesClient } from "../../hr/leaves/hr-leaves-client";

export const metadata = { title: "อนุมัติการลา" };

export default async function ApproveLeavesPage() {
  const requests = await getAllLeaveRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">อนุมัติการลา</h1>
        <p className="text-muted-foreground">ตรวจสอบและอนุมัติ/ปฏิเสธคำขอลาของพนักงาน</p>
      </div>

      <HrLeavesClient requests={requests} />
    </div>
  );
}
