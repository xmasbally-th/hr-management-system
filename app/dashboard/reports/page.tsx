import {
  getReportLeaveByType,
  getReportTravelBudget,
  getReportMonthlyLeaves,
  getCalendarEvents,
} from "@/lib/actions/report-actions";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "รายงาน" };

export default async function ReportsPage() {
  const now = new Date();
  const [leaveByType, travelBudget, monthlyLeaves, calendarEvents] = await Promise.all([
    getReportLeaveByType(),
    getReportTravelBudget(),
    getReportMonthlyLeaves(),
    getCalendarEvents(now.getFullYear(), now.getMonth() + 1),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รายงาน</h1>
        <p className="text-muted-foreground">สรุปสถิติการลา, งบประมาณการเดินทาง และปฏิทินกิจกรรม</p>
      </div>

      <ReportsClient
        leaveByType={leaveByType}
        travelBudget={travelBudget}
        monthlyLeaves={monthlyLeaves}
        initialCalendarEvents={calendarEvents}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth() + 1}
      />
    </div>
  );
}
