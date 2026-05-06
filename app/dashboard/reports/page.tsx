import {
  getReportLeaveByType,
  getReportTravelBudget,
  getReportMonthlyLeaves,
} from "@/lib/actions/report-actions";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "รายงาน" };

export default async function ReportsPage() {
  const [leaveByType, travelBudget, monthlyLeaves] = await Promise.all([
    getReportLeaveByType(),
    getReportTravelBudget(),
    getReportMonthlyLeaves(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รายงาน</h1>
        <p className="text-muted-foreground">สรุปสถิติการลา, งบประมาณการเดินทาง และภาพรวมบุคลากร</p>
      </div>

      <ReportsClient
        leaveByType={leaveByType}
        travelBudget={travelBudget}
        monthlyLeaves={monthlyLeaves}
      />
    </div>
  );
}
