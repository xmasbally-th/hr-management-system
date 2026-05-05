import { getAllLeaveRequests } from "@/lib/actions/leave-actions";
import { HrLeavesClient } from "./hr-leaves-client";

export const metadata = { title: "จัดการการลา (HR)" };

export default async function HrLeavesPage() {
  const requests = await getAllLeaveRequests();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดการการลา</h1>
        <p className="text-muted-foreground">ตรวจสอบและอนุมัติคำขอลาของพนักงานทั้งหมด</p>
      </div>

      <HrLeavesClient requests={requests} />
    </div>
  );
}
