import {
  getLeaveTypes,
  getEmployeesForSelection,
  getMyLeaveBalances,
} from "@/lib/actions/leave-actions";
import { getLeaveOnlineEnabled, getLeavePolicy, getExamDutyPositions } from "@/lib/actions/settings-actions";
import { getMyProfile } from "@/lib/actions/profile-actions";
import { getExamPeriods } from "@/lib/actions/exam-period-actions";
import { currentFiscalYear } from "@/lib/date-ranges";
import { matchesExamDuty } from "@/lib/exam-period";
import { LeaveRequestForm } from "./leave-request-form";

export const metadata = { title: "ยื่นคำขอลา" };

export default async function NewLeavePage() {
  const curFy = currentFiscalYear();
  const [
    leaveTypes,
    balancesRaw,
    leaveOnlineEnabled,
    profile,
    policy,
    examThisFy,
    examNextFy,
    dutyPositions,
  ] = await Promise.all([
    getLeaveTypes(),
    getMyLeaveBalances().catch(() => []),
    getLeaveOnlineEnabled(),
    getMyProfile(),
    getLeavePolicy(),
    getExamPeriods(curFy).catch(() => []),
    getExamPeriods(curFy + 1).catch(() => []),
    getExamDutyPositions().catch(() => []),
  ]);

  const examPeriods = [...examThisFy, ...examNextFy];
  const hasExamDuty = matchesExamDuty(profile.position_title ?? null, dutyPositions);

  let employees: { id: string; full_name: string; email: string }[] = [];
  try {
    employees = await getEmployeesForSelection();
  } catch {
    // Non-HR users won't have access — that's expected
  }

  const balances = (balancesRaw ?? []).map((b) => {
    const r = b as Record<string, unknown>;
    const lt = r.leave_type as { name: string } | null;
    return {
      typeName: lt?.name ?? "",
      totalDays: Number(r.total_days ?? 0),
      usedDays: Number(r.used_days ?? 0),
      accumulatedDays: Number(r.accumulated_days ?? 0),
    };
  });

  return (
    <LeaveRequestForm
      leaveTypes={leaveTypes}
      employees={employees}
      balances={balances}
      leaveOnlineEnabled={leaveOnlineEnabled}
      gender={profile.gender ?? null}
      employeeType={profile.employee_type ?? null}
      policy={policy}
      examPeriods={examPeriods}
      hasExamDuty={hasExamDuty}
    />
  );
}
