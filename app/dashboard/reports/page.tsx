import {
  getReportLeaveByType,
  getReportTravelBudget,
  getReportMonthlyLeaves,
  getCalendarEvents,
} from "@/lib/actions/report-actions";
import {
  resolveRange,
  currentFiscalYear,
  fiscalYearRange,
  type RangePreset,
} from "@/lib/date-ranges";
import { ReportsClient } from "./reports-client";
import { RangeSelector } from "./_components/range-selector";

export const metadata = { title: "รายงาน" };

const VALID_PRESETS: RangePreset[] = [
  "calendar-year",
  "fiscal-year",
  "performance-h1",
  "performance-h2",
  "custom",
];

interface PageProps {
  searchParams: Promise<{
    range?: string;
    year?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Resolve range — default = current fiscal year (most useful for ราชการ)
  const requestedPreset = (params.range ?? "fiscal-year") as RangePreset;
  const preset: RangePreset = VALID_PRESETS.includes(requestedPreset)
    ? requestedPreset
    : "fiscal-year";
  const defaultYear = currentFiscalYear();
  const year = params.year ? Number(params.year) || defaultYear : defaultYear;

  const range =
    resolveRange(preset, year, params.start, params.end) ??
    fiscalYearRange(defaultYear);

  const now = new Date();
  const [leaveByType, travelBudget, monthlyLeaves, calendarEvents] = await Promise.all([
    getReportLeaveByType({ start: range.start, end: range.end }),
    getReportTravelBudget({ start: range.start, end: range.end }),
    getReportMonthlyLeaves({ start: range.start, end: range.end }),
    getCalendarEvents(now.getFullYear(), now.getMonth() + 1),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รายงาน</h1>
        <p className="text-muted-foreground">
          สรุปสถิติการลา · งบประมาณการเดินทาง · ปฏิทินกิจกรรม
        </p>
      </div>

      <RangeSelector
        current={range}
        initialPreset={preset}
        initialYear={year}
      />

      <ReportsClient
        leaveByType={leaveByType}
        travelBudget={travelBudget}
        monthlyLeaves={monthlyLeaves}
        initialCalendarEvents={calendarEvents}
        initialYear={now.getFullYear()}
        initialMonth={now.getMonth() + 1}
        rangeLabel={range.label}
      />
    </div>
  );
}
